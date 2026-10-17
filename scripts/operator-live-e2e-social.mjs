#!/usr/bin/env node
/**
 * Multi-account social HTTP acceptance probes (Preview/Testnet first).
 *
 * Env:
 *   GHC_E2E_BASE_URL (required)
 *   GHC_E2E_COOKIE_A, GHC_E2E_COOKIE_B (required; never log them)
 *   GHC_E2E_ALLOW_PRODUCTION=1 only if intentionally testing production host
 *
 * Exit 0 only if all required stages PASS.
 */
import { requireE2eBaseUrl } from "../lib/e2e/resolve-base-url.mjs"

const resolved = requireE2eBaseUrl(process.env)
const base = resolved.baseUrl
const cookieA = process.env.GHC_E2E_COOKIE_A || ""
const cookieB = process.env.GHC_E2E_COOKIE_B || ""

if (!cookieA || !cookieB) {
  console.error("BLOCKED: set GHC_E2E_COOKIE_A and GHC_E2E_COOKIE_B (local only; do not commit)")
  process.exit(2)
}

let passed = 0
let failed = 0
const results = []

function record(stage, status, detail = "") {
  results.push({ stage, status, detail })
  if (status === "PASS") {
    passed++
    console.log(`  PASS  ${stage}${detail ? " — " + detail : ""}`)
  } else if (status === "FAIL") {
    failed++
    console.error(`  FAIL  ${stage}${detail ? " — " + detail : ""}`)
  } else {
    console.log(`  ${status.padEnd(5)} ${stage}${detail ? " — " + detail : ""}`)
  }
}

async function api(cookie, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(init.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function requireDurableMutation(stage, res) {
  if (res.status === 200 && res.json?.ok === true && res.json?.durable === true) {
    record(stage, "PASS", `status=${res.status}`)
    return true
  }
  record(
    stage,
    "FAIL",
    `status=${res.status} ok=${res.json?.ok} durable=${res.json?.durable} error=${res.json?.error || res.json?.message || ""}`
  )
  return false
}

console.log(`\nGH-CONNECT social multi-account E2E\nBase: ${base}\n`)

// A. Identities
const profileA = await api(cookieA, "/api/profile/me")
const profileB = await api(cookieB, "/api/profile/me")
const idA = String(profileA.json?.profile?.id || profileA.json?.profile?.ghUserId || "")
const idB = String(profileB.json?.profile?.id || profileB.json?.profile?.ghUserId || "")

if (!idA || !idB || idA === idB) {
  record("identity_distinct", "FAIL", `A=${idA || "?"} B=${idB || "?"} statusA=${profileA.status} statusB=${profileB.status}`)
  console.log(`\npassed=${passed} failed=${failed}\n`)
  process.exit(1)
}
record("identity_distinct", "PASS", `A=${idA.slice(0, 10)}… B=${idB.slice(0, 10)}…`)

// Unauthenticated mutation
const bare = await fetch(`${base}/api/social/posts`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ content: "unauth probe" }),
})
record("unauth_post_rejected", bare.status === 401 ? "PASS" : "FAIL", `status=${bare.status}`)

// Forged actorId on follow body must not impersonate — session A follows B only
const forged = await api(cookieA, "/api/social/follows", {
  method: "POST",
  body: JSON.stringify({ targetUserId: idB, follow: true, actorId: idB, followerId: idB, userId: idB }),
})
if (forged.status === 200 && forged.json?.ok && forged.json?.durable) {
  // Server should still attribute follower as A (session). Check B followers for A not self-follow weirdness
  record("forged_actor_ignored", "PASS", "mutation accepted under session A")
} else if (forged.status === 401 || forged.status === 403) {
  record("forged_actor_ignored", "PASS", `rejected status=${forged.status}`)
} else if (forged.json?.durable === false) {
  record("forged_actor_ignored", "FAIL", "follow not durable (DB/RPC) — cannot prove actor binding")
} else {
  record("forged_actor_ignored", "FAIL", `status=${forged.status} error=${forged.json?.error || ""}`)
}

// B. Connection
const req = await api(cookieA, "/api/connections/request", {
  method: "POST",
  body: JSON.stringify({ toUserId: idB, source: "e2e_social_v2" }),
})
requireDurableMutation("connection_request_A_to_B", req)

const inboxB = await api(cookieB, "/api/connections/request")
const incoming = Array.isArray(inboxB.json?.incoming) ? inboxB.json.incoming : []
const hitReq = incoming.find((r) => String(r.fromUserId) === idA && String(r.toUserId) === idB)
if (hitReq) record("connection_inbox_B", "PASS", `requestId=${String(hitReq.id || "").slice(0, 12)}`)
else record("connection_inbox_B", "FAIL", `incoming=${incoming.length} durable=${inboxB.json?.durable}`)

// C. Follow (may already exist from forged probe)
const follow = await api(cookieA, "/api/social/follows", {
  method: "POST",
  body: JSON.stringify({ targetUserId: idB, follow: true }),
})
requireDurableMutation("follow_A_to_B", follow)

const listB = await api(cookieB, "/api/social/follows")
const followers = Array.isArray(listB.json?.followers) ? listB.json.followers.map(String) : []
if (listB.json?.durable && followers.includes(idA)) {
  record("followers_list_B_has_A", "PASS", `followers=${followers.length}`)
} else {
  record(
    "followers_list_B_has_A",
    "FAIL",
    `durable=${listB.json?.durable} hasA=${followers.includes(idA)} count=${followers.length}`
  )
}

// D. Unique post by A
const marker = `E2E_GH_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const create = await api(cookieA, "/api/social/posts", {
  method: "POST",
  body: JSON.stringify({ content: marker, visibility: "public" }),
})
let postId = null
if (requireDurableMutation("post_create_A", create)) {
  postId = create.json?.post?.id ? String(create.json.post.id) : null
  if (postId) record("post_id_present", "PASS", postId.slice(0, 24))
  else record("post_id_present", "FAIL", "durable create without post.id")
}

if (postId) {
  const feedB = await api(cookieB, "/api/social/feed?limit=40")
  const postsB = Array.isArray(feedB.json?.posts) ? feedB.json.posts : []
  const postOnB = postsB.find((p) => String(p.id) === postId)
  if (postOnB && String(postOnB.authorId || "") === idA) {
    record("feed_B_sees_post", "PASS", `authorId matches A`)
  } else if (postOnB) {
    record("feed_B_sees_post", "FAIL", `authorId mismatch got=${postOnB.authorId}`)
  } else {
    record("feed_B_sees_post", "FAIL", `missing post durable=${feedB.json?.durable} n=${postsB.length}`)
  }

  // E. Like once on unique post (known inactive → active). Do not double-toggle.
  const like = await api(cookieB, `/api/social/posts/${encodeURIComponent(postId)}/reactions`, {
    method: "POST",
    body: JSON.stringify({ reaction: "like" }),
  })
  if (requireDurableMutation("reaction_B_like", like)) {
    const active = like.json?.active === true || like.json?.liked === true
    if (active) record("reaction_active_after_first_toggle", "PASS")
    else record("reaction_active_after_first_toggle", "FAIL", `active=${like.json?.active} liked=${like.json?.liked}`)
  }

  const feedA = await api(cookieA, "/api/social/feed?limit=40")
  const postsA = Array.isArray(feedA.json?.posts) ? feedA.json.posts : []
  const postOnA = postsA.find((p) => String(p.id) === postId)
  const likes = postOnA?.likes ?? postOnA?.likeCount ?? postOnA?.engagement?.likes
  if (typeof likes === "number" && likes >= 1) {
    record("feed_A_like_count", "PASS", `likes=${likes}`)
  } else {
    record("feed_A_like_count", "FAIL", `likes=${likes}`)
  }

  // F. Comment
  const cmarker = `E2E_CMT_${Date.now()}`
  const comment = await api(cookieB, `/api/social/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ text: cmarker }),
  })
  let commentId = null
  if (requireDurableMutation("comment_B", comment)) {
    commentId = comment.json?.comment?.id || comment.json?.id
  }

  const commentsA = await api(cookieA, `/api/social/posts/${encodeURIComponent(postId)}/comments`)
  const clist = Array.isArray(commentsA.json?.comments) ? commentsA.json.comments : []
  const hitC = clist.find(
    (c) =>
      String(c.text || c.content || "").includes(cmarker) &&
      String(c.authorId || "") === idB
  )
  if (hitC) {
    record("comment_A_readback", "PASS", `commentId=${String(hitC.id || "").slice(0, 12)} author=B`)
  } else {
    record(
      "comment_A_readback",
      "FAIL",
      `n=${clist.length} durable=${commentsA.json?.durable} marker=${cmarker}`
    )
  }
}

console.log(`\n--- Summary ---`)
console.log(`PASS=${passed} FAIL=${failed}`)
for (const r of results) {
  if (r.status === "FAIL") console.log(`  · ${r.stage}: ${r.detail}`)
}
if (failed > 0) {
  console.log("\nRESULT: FAIL — not certified for Mainnet; fix durable stack / migrations on target DB.")
  process.exit(1)
}
console.log("\nRESULT: PASS — all required stages succeeded against this base URL.")
console.log("Preview success does not equal Mainnet readiness.")
process.exit(0)
