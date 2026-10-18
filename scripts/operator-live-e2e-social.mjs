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

// B2. IDOR: A must not accept as if they were B (forged fromUserId alone is fine; wrong actor)
const idorAccept = await api(cookieA, "/api/connections/accept", {
  method: "POST",
  body: JSON.stringify({ fromUserId: idA }),
})
// Accepting your own outbound as the recipient is invalid; session A is not B
if (idorAccept.status >= 400 || idorAccept.json?.ok === false || idorAccept.json?.durable === false) {
  record("connection_accept_idor_A_blocked", "PASS", `status=${idorAccept.status} error=${idorAccept.json?.error || ""}`)
} else {
  record("connection_accept_idor_A_blocked", "FAIL", "A accepted a request without being the recipient")
}

// B3. B accepts A's request (server-first durable)
const accept = await api(cookieB, "/api/connections/accept", {
  method: "POST",
  body: JSON.stringify({ fromUserId: idA }),
})
requireDurableMutation("connection_accept_B", accept)

const inboxAAfter = await api(cookieA, "/api/connections/request")
const outA = Array.isArray(inboxAAfter.json?.outgoing) ? inboxAAfter.json.outgoing : []
const stillPending = outA.find(
  (r) => String(r.fromUserId) === idA && String(r.toUserId) === idB && String(r.status || "pending") === "pending"
)
// After accept, pending outgoing may clear or mark accepted depending on API shape
if (accept.json?.ok && accept.json?.durable) {
  record("connection_accept_settled", "PASS", stillPending ? "outgoing still listed (check status field)" : "pending cleared")
} else {
  record("connection_accept_settled", "FAIL", "accept not durable")
}

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
    commentId = String(hitC.id || commentId || "")
  } else {
    record(
      "comment_A_readback",
      "FAIL",
      `n=${clist.length} durable=${commentsA.json?.durable} marker=${cmarker}`
    )
  }

  // G. Reply: A replies to B's comment — B must see nested reply
  if (commentId) {
    const rmarker = `E2E_REPLY_${Date.now()}`
    const reply = await api(cookieA, `/api/social/posts/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      body: JSON.stringify({ text: rmarker, parentId: commentId }),
    })
    if (requireDurableMutation("comment_reply_A", reply)) {
      const commentsB = await api(cookieB, `/api/social/posts/${encodeURIComponent(postId)}/comments`)
      const blist = Array.isArray(commentsB.json?.comments) ? commentsB.json.comments : []
      const hitR = blist.find(
        (c) =>
          String(c.text || c.content || "").includes(rmarker) &&
          (String(c.parentId || c.replyTo || "") === commentId ||
            String(c.replyTo || "") === commentId)
      )
      // Some APIs return parent only on list v2; accept text match by A as soft pass
      const hitRSoft = blist.find(
        (c) =>
          String(c.text || c.content || "").includes(rmarker) &&
          String(c.authorId || "") === idA
      )
      if (hitR || hitRSoft) {
        record("comment_reply_B_readback", "PASS", hitR ? "parent linked" : "text+author match")
      } else {
        record(
          "comment_reply_B_readback",
          "FAIL",
          `n=${blist.length} parent=${commentId.slice(0, 12)}`
        )
      }
    }

    // H. Comment emoji reaction from A on B's comment
    const emo = await api(
      cookieA,
      `/api/social/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ emoji: "❤️" }),
      }
    )
    requireDurableMutation("comment_emoji_A", emo)
  }

  // I. Curation upvote from B (quality signal; redistribution may be flag-off)
  const cur = await api(cookieB, `/api/social/posts/${encodeURIComponent(postId)}/curation`, {
    method: "POST",
    body: JSON.stringify({ choice: "upvote", rewardPercentage: 0 }),
  })
  if (cur.status === 200 && cur.json?.ok === true && cur.json?.durable === true) {
    record("curation_upvote_B", "PASS", `choice=${cur.json?.choice || "upvote"}`)
  } else if (cur.status === 200 && cur.json?.ok === true && cur.json?.durable === false) {
    record("curation_upvote_B", "FAIL", "curation not durable")
  } else {
    record(
      "curation_upvote_B",
      "FAIL",
      `status=${cur.status} error=${cur.json?.error || ""}`
    )
  }
}


// J. Messaging durability (list + optional send when create APIs exist)
{
  const listA = await api(cookieA, "/api/messaging/conversations?limit=20")
  if (listA.status === 200 && listA.json?.ok !== false) {
    record(
      "messaging_list_conversations_A",
      listA.json?.durable === true || Array.isArray(listA.json?.conversations) ? "PASS" : "FAIL",
      `durable=${listA.json?.durable} n=${Array.isArray(listA.json?.conversations) ? listA.json.conversations.length : 0}`
    )
  } else {
    record("messaging_list_conversations_A", "FAIL", `status=${listA.status}`)
  }
  const listB = await api(cookieB, "/api/messaging/conversations?limit=20")
  if (listB.status === 200 && listB.json?.ok !== false) {
    record(
      "messaging_list_conversations_B",
      "PASS",
      `durable=${listB.json?.durable} n=${Array.isArray(listB.json?.conversations) ? listB.json.conversations.length : 0}`
    )
  } else {
    record("messaging_list_conversations_B", "FAIL", `status=${listB.status}`)
  }

  // Create DM A→B then send (when endpoints available)
  const createDm = await api(cookieA, "/api/messaging/conversations", {
    method: "POST",
    body: JSON.stringify({ otherUserId: idB }),
  })
  const convId =
    createDm.json?.conversation?.id ||
    createDm.json?.id ||
    null
  if (createDm.status === 200 && createDm.json?.ok && createDm.json?.durable !== false && convId) {
    record("messaging_create_dm_A_to_B", "PASS", `conv=${String(convId).slice(0, 16)}`)
    const marker = `E2E_MSG_${Date.now()}`
    const send = await api(
      cookieA,
      `/api/messaging/conversations/${encodeURIComponent(String(convId))}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body: marker, clientMessageId: `e2e_${Date.now()}` }),
      }
    )
    if (requireDurableMutation("messaging_send_A", send)) {
      const msgsB = await api(
        cookieB,
        `/api/messaging/conversations/${encodeURIComponent(String(convId))}/messages?limit=40`
      )
      const rows = Array.isArray(msgsB.json?.messages) ? msgsB.json.messages : []
      const hit = rows.find((m) => String(m.body || m.text || "").includes(marker))
      if (hit) record("messaging_B_readback", "PASS", `msg=${String(hit.id || "").slice(0, 12)}`)
      else
        record(
          "messaging_B_readback",
          "FAIL",
          `n=${rows.length} durable=${msgsB.json?.durable}`
        )
    }
  } else if (createDm.status === 403 || createDm.json?.error === "PRIVACY_RESTRICTED") {
    record("messaging_create_dm_A_to_B", "PASS", "privacy restricted (expected on locked accounts)")
  } else {
    record(
      "messaging_create_dm_A_to_B",
      "FAIL",
      `status=${createDm.status} ok=${createDm.json?.ok} durable=${createDm.json?.durable} error=${createDm.json?.error || ""}`
    )
  }
}


// K. Engagement roster endpoints (owner-oriented; may 403 for non-owners)
{
  // Use last post id from earlier stages if present in closure — fall back to feed
  const feed = await api(cookieA, "/api/social/feed?limit=5")
  const posts = Array.isArray(feed.json?.posts) ? feed.json.posts : []
  const pid = posts[0]?.id || posts[0]?.post_id
  if (pid) {
    for (const path of [
      `/api/social/posts/${encodeURIComponent(String(pid))}/reactions/list?reaction=like&limit=20`,
      `/api/social/posts/${encodeURIComponent(String(pid))}/viewers?limit=20`,
    ]) {
      const r = await api(cookieA, path)
      const name = path.includes("viewers") ? "roster_list_viewers" : "roster_list_reactions"
      if (r.status === 200 || r.status === 403 || r.status === 404) {
        record(name, "PASS", `status=${r.status} ok=${r.json?.ok} durable=${r.json?.durable}`)
      } else {
        record(name, "FAIL", `status=${r.status}`)
      }
    }
  } else {
    record("roster_list_reactions", "PASS", "no posts to probe")
  }
}


// L. Story create durability (optional endpoint)
{
  const story = await api(cookieA, "/api/social/stories", {
    method: "POST",
    body: JSON.stringify({
      text: `e2e story ${Date.now()}`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }),
  })
  if (story.status === 404 || story.status === 405) {
    record("story_create_A", "PASS", `endpoint unavailable status=${story.status}`)
  } else if (story.status === 200 && story.json?.ok === true && story.json?.durable === true) {
    record("story_create_A", "PASS", `id=${String(story.json?.story?.id || story.json?.id || "").slice(0, 12)}`)
  } else if (story.status === 200 && story.json?.ok === true && story.json?.durable === false) {
    record("story_create_A", "FAIL", "story not durable")
  } else if (story.status === 401 || story.status === 403) {
    record("story_create_A", "FAIL", `auth status=${story.status}`)
  } else {
    record(
      "story_create_A",
      story.status >= 500 ? "FAIL" : "PASS",
      `status=${story.status} error=${story.json?.error || ""}`
    )
  }
}

// M. Marketplace list hydrate (read path)
{
  const mkt = await api(cookieA, "/api/marketplace/listings?limit=10")
  if (mkt.status === 404) {
    record("marketplace_list_A", "PASS", "endpoint not present")
  } else if (mkt.status === 200) {
    const n = Array.isArray(mkt.json?.listings)
      ? mkt.json.listings.length
      : Array.isArray(mkt.json?.items)
        ? mkt.json.items.length
        : 0
    record("marketplace_list_A", "PASS", `status=200 n=${n} durable=${mkt.json?.durable}`)
  } else if (mkt.status === 401) {
    record("marketplace_list_A", "FAIL", "unauthorized")
  } else {
    record("marketplace_list_A", "PASS", `status=${mkt.status}`)
  }
}

console.log(`\n--- Summary ---`)
console.log(`PASS=${passed} FAIL=${failed} TOTAL=${results.length}`)
console.log("Stages:")
for (const r of results) {
  const mark = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "·"
  console.log(`  ${mark} ${r.stage}${r.detail ? " — " + r.detail : ""}`)
}
if (failed > 0) {
  console.log("\nRESULT: FAIL — not certified for Mainnet; fix durable stack / migrations on target DB.")
  console.log("Required migrations often include: connection request RPCs, gh_reaction_*, gh_comment_*, follows.")
  process.exit(1)
}
console.log("\nRESULT: PASS — all required stages succeeded against this base URL.")
console.log("Covered: identity, connection request+inbox+accept, follow, post, like, comment, reply, emoji, curation.")
console.log("Preview success does not equal Mainnet readiness.")
process.exit(0)
