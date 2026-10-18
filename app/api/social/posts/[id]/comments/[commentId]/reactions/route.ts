/**
 * POST /api/social/posts/[id]/comments/[commentId]/reactions
 * Body: { emoji: string } — toggle comment emoji reaction (session actor).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"

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
