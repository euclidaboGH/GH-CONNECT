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
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  if (!socialDbConfigured()) return NextResponse.json({ ok: true, durable: false, posts: [], message: "SOCIAL_DB_UNAVAILABLE" })

  const url = new URL(request.url)
  const limit = Math.min(40, Math.max(1, Number(url.searchParams.get("limit") || 12) || 12))
  const before = url.searchParams.get("before")
  const beforeId = String(url.searchParams.get("beforeId") || "").trim()
  const modeRaw = String(url.searchParams.get("mode") || "latest").toLowerCase()
  const mode = ["latest", "following", "trending"].includes(modeRaw) ? modeRaw : "latest"
  const beforeMs = before && Number.isFinite(Number(before)) ? Number(before) : null
  const result = await socialRpc("gh_short_video_list", {
    p_viewer_id: auth.userId, p_limit: limit, p_before_ms: beforeMs, p_before_id: beforeMs == null ? null : beforeId, p_mode: mode,
  })
  if (!result.ok) return NextResponse.json({ ok: false, durable: false, error: result.error || "PULSE_UNAVAILABLE", posts: [] }, { status: 503 })
  const payload = result.data as { posts?: FeedPost[]; mode?: string; stableCursor?: boolean }
  const posts = Array.isArray(payload?.posts) ? payload.posts.filter(isShortVideoPost) : []
  const last = posts[posts.length - 1]
  const lastMs = last && Number(last.createdAt)
  return NextResponse.json({
    ok: true, durable: true, posts, mode: payload?.mode || mode, stableCursor: Boolean(payload?.stableCursor),
    nextCursor: mode !== "trending" && last?.id && Number.isFinite(lastMs) ? { before: lastMs, beforeId: String(last.id) } : null,
    ranking: mode === "trending" ? "server_signal" : mode,
  })
}
