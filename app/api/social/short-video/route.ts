/**
 * GET /api/social/short-video — chronological short-form video posts.
 * Uses authoritative gh_posts (video present). No ranking, no rewards.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type FeedPost = {
  id?: string
  video?: string | null
  contentType?: string
  content_type?: string
  deletedAt?: string | null
  [key: string]: unknown
}

function isShortVideoPost(p: FeedPost): boolean {
  const video = typeof p.video === "string" ? p.video.trim() : ""
  if (!video || video.startsWith("blob:")) return false
  const ct = String(p.contentType || p.content_type || "").toLowerCase()
  if (ct === "short_video" || ct === "reel") return true
  // Any public post with a durable video ref is eligible for the short-video surface
  return Boolean(video)
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      posts: [],
      message: "SOCIAL_DB_UNAVAILABLE",
    })
  }

  const url = new URL(request.url)
  const limit = Math.min(40, Math.max(1, Number(url.searchParams.get("limit") || 24) || 24))
  const beforeMs = url.searchParams.get("before")
  const before =
    beforeMs && Number.isFinite(Number(beforeMs)) ? Number(beforeMs) : null

  const result = await socialRpc("gh_post_list_feed", {
    p_viewer_id: auth.userId,
    p_limit: Math.min(80, limit * 2),
    p_before_ms: before,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, durable: false, error: result.error || "FEED_UNAVAILABLE", posts: [] },
      { status: 503 }
    )
  }

  const payload = result.data as { posts?: FeedPost[] }
  const all = Array.isArray(payload?.posts) ? payload.posts : []
  const posts = all.filter(isShortVideoPost).slice(0, limit)

  return NextResponse.json({
    ok: true,
    durable: true,
    posts,
    // Explicit: chronological / feed order only — not algorithmic ranking
    ranking: "chronological",
  })
}
