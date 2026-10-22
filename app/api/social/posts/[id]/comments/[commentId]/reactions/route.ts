/**
 * POST /api/social/posts/[id]/comments/[commentId]/reactions
 * Body: { emoji: string } — toggle comment emoji reaction (session actor).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"
import { canViewSocialPost, commentBelongsToPost } from "@/lib/server/social/post-visibility"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`cmt-react:${auth.userId}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }
  const { id, commentId } = await ctx.params
  const postId = String(id || "").trim()
  const cId = String(commentId || "").trim()
  if (!postId || !cId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  const canView = await canViewSocialPost(auth.userId, postId)
  if (canView === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!canView) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  const belongs = await commentBelongsToPost(postId, cId)
  if (belongs === null) return NextResponse.json({ ok: false, error: "COMMENT_LOOKUP_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!belongs) return NextResponse.json({ ok: false, error: "COMMENT_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  const body = (await request.json().catch(() => ({}))) as { emoji?: string }
  const emoji = String(body.emoji || "").trim().slice(0, 16)
  if (!emoji) {
    return NextResponse.json({ ok: false, error: "EMOJI_REQUIRED" }, { status: 400 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Comment reaction", { extra: { emoji } })
    return NextResponse.json(nd.body, { status: nd.status })
  }

  const result = await socialRpc("gh_comment_reaction_toggle", {
    p_post_id: postId,
    p_comment_id: cId,
    p_user_id: auth.userId,
    p_emoji: emoji,
  })
  const data = (result.data || {}) as {
    ok?: boolean
    error?: string
    active?: boolean
    counts?: Record<string, number>
  }
  if (!result.ok || data.ok === false) {
    const code = String(data.error || result.error || "REACTION_FAILED")
    const status = code === "COMMENT_NOT_FOUND" ? 404 : 503
    return NextResponse.json({ ok: false, error: code, durable: false }, { status })
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    emoji,
    active: Boolean(data.active),
    counts: data.counts || {},
  })
}

/** GET — reaction counts for a comment (cross-account) */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const auth = await resolveAuthenticatedUser(_request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { id, commentId } = await ctx.params
  const postId = String(id || "").trim()
  const cId = String(commentId || "").trim()
  if (!postId || !cId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  const canView = await canViewSocialPost(auth.userId, postId)
  if (canView === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!canView) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  const belongs = await commentBelongsToPost(postId, cId)
  if (belongs === null) return NextResponse.json({ ok: false, error: "COMMENT_LOOKUP_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!belongs) return NextResponse.json({ ok: false, error: "COMMENT_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  if (!socialDbConfigured()) {
    return NextResponse.json({ ok: true, durable: false, counts: {} })
  }
  const result = await socialRpc("gh_comment_reaction_list", { p_comment_id: cId })
  const data = (result.data || {}) as {
    ok?: boolean
    counts?: Record<string, number>
    reactions?: Array<{ emoji?: unknown }>
    error?: string
  }
  if (!result.ok || data.ok === false) {
    return NextResponse.json(
      { ok: false, error: data.error || result.error || "LIST_FAILED", durable: false },
      { status: 503 }
    )
  }
  // The current service-role RPC returns a roster (`reactions`), not a
  // pre-aggregated `counts` object. Aggregate server-side and never return the
  // user roster to the client.
  const counts = data.counts && typeof data.counts === "object"
    ? data.counts
    : (Array.isArray(data.reactions) ? data.reactions.reduce<Record<string, number>>((out, row) => {
        const emoji = String(row?.emoji || "").trim().slice(0, 16)
        if (emoji) out[emoji] = (out[emoji] || 0) + 1
        return out
      }, {}) : {})
  return NextResponse.json({
    ok: true,
    durable: true,
    counts,
  })
}
