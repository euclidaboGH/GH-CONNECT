/**
 * GET /api/social/feed — durable feed for authenticated viewer.
 * Server derives actor from session; client cannot impersonate.
 * Post-filters muted authors when mute rows are available.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc, socialRest } from "@/lib/server/social/rpc"
import { nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function mutedAuthorIds(viewerId: string): Promise<Set<string>> {
  const out = new Set<string>()
  try {
    const q = `gh_user_mutes?muter_id=eq.${encodeURIComponent(viewerId)}&select=muted_id`
    const result = await socialRest<Array<{ muted_id: string }>>(q)
    if (result.ok && Array.isArray(result.data)) {
      for (const row of result.data) {
        const id = String(row.muted_id || "").trim()
        if (id) out.add(id)
      }
    }
  } catch {
    /* feed still returns; mute filter best-effort */
  }
  return out
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Social feed", { posts: [], message: "SOCIAL_DB_UNAVAILABLE" })
    return NextResponse.json(nd.body, {
      status: nd.status,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 50)
  const before = url.searchParams.get("before")
  const beforeMs = before ? Number(before) : null

  const result = await socialRpc("gh_post_list_feed", {
    p_viewer_id: auth.userId,
    p_limit: limit,
    p_before_ms: beforeMs && Number.isFinite(beforeMs) ? beforeMs : null,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: true,
        durable: false,
        posts: [],
        message: result.error || "FEED_RPC_UNAVAILABLE",
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  const payload = result.data as { ok?: boolean; posts?: unknown[] }
  let posts = Array.isArray(payload?.posts) ? payload.posts : []

  // Server-side mute enforcement (RPC still handles blocks).
  const muted = await mutedAuthorIds(auth.userId)
  if (muted.size > 0) {
    posts = posts.filter((p) => {
      const authorId = String(
        (p as { authorId?: string; author_id?: string }).authorId ||
          (p as { author_id?: string }).author_id ||
          ""
      )
      return !authorId || !muted.has(authorId)
    })
  }

  // Apply durable personal feedback after the database's hard eligibility/privacy
  // filtering. Personal preferences can reorder eligible content but can never
  // override block, visibility, moderation, or audience restrictions.
  let preferenceState: "applied" | "unavailable" = "unavailable"
  let hiddenByPreference = 0
  let demotedByPreference = 0
  let promotedByPreference = 0
  const preferenceResult = await socialRpc("gh_post_curation_feedback_list", {
    p_user_id: auth.userId,
  })
  const preferencePayload = preferenceResult.data as {
    ok?: boolean
    items?: Array<{ postId?: string; feedback?: string }>
  } | null
  if (preferenceResult.ok && preferencePayload?.ok !== false && Array.isArray(preferencePayload?.items)) {
    const feedbackByPost = new Map<string, string>()
    for (const item of preferencePayload.items) {
      const id = String(item.postId || "").trim()
      const feedback = String(item.feedback || "")
      if (id && ["hide", "show_less", "show_more"].includes(feedback)) feedbackByPost.set(id, feedback)
    }
    const before = posts.length
    posts = posts.filter((post) => {
      const id = String((post as { id?: string }).id || "").trim()
      return !id || feedbackByPost.get(id) !== "hide"
    })
    hiddenByPreference = before - posts.length
    const priority = (post: unknown) => {
      const id = String((post as { id?: string }).id || "").trim()
      const feedback = feedbackByPost.get(id)
      if (process.env.GHC_RANKING_PAUSED === "1") return 1
      if (feedback === "show_more") return 0
      if (feedback === "show_less") return 2
      return 1
    }
    const originalOrder = new Map(posts.map((post, index) => [String((post as { id?: string }).id || ""), index]))
    posts = [...posts].sort((a, b) => priority(a) - priority(b) ||
      (originalOrder.get(String((a as { id?: string }).id || "")) || 0) -
      (originalOrder.get(String((b as { id?: string }).id || "")) || 0))
    promotedByPreference = posts.filter((post) => priority(post) === 0).length
    demotedByPreference = posts.filter((post) => priority(post) === 2).length
    preferenceState = "applied"
  }

  return NextResponse.json(
    {
      ok: true,
      durable: true,
      posts,
      mutedFiltered: muted.size,
      curation: {
        preferences: preferenceState,
        hiddenByPreference,
        demotedByPreference,
        promotedByPreference,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
