/**
 * DELETE /api/social/posts/[id]/comments/[commentId]
 * Soft-delete own comment only (session actor).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"
import { canViewSocialPost } from "@/lib/server/social/post-visibility"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; commentId: string }> }

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`comment-delete:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  const { id, commentId } = await ctx.params
  const postId = String(id || "").trim()
  const cid = String(commentId || "").trim()
  if (!postId || postId.length > 128 || !cid || cid.length > 160) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Comment delete")
    return NextResponse.json(nd.body, { status: nd.status })
  }
  const result = await socialRpc("gh_comment_delete", {
    p_post_id: postId,
    p_comment_id: cid,
    p_actor_id: auth.userId,
  })
  const data = (result.data || {}) as { ok?: boolean; error?: string; idempotent?: boolean; commentCount?: number }
  if (!result.ok || data.ok !== true) {
    const code = String(data.error || result.error || "DELETE_FAILED")
    const status = code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" || code === "POST_NOT_FOUND" ? 404 : code === "INVALID" ? 400 : 503
    return NextResponse.json({ ok: false, durable: false, error: code }, { status, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, durable: true, idempotent: Boolean(data.idempotent), id: cid, commentCount: Number.isFinite(data.commentCount) ? Math.max(0, Number(data.commentCount)) : undefined }, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`comment-update:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  const { id, commentId } = await ctx.params
  const postId = String(id || "").trim()
  const cid = String(commentId || "").trim()
  if (!postId || postId.length > 128 || !cid || cid.length > 160) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  const canView = await canViewSocialPost(auth.userId, postId)
  if (canView === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!canView) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Comment update")
    return NextResponse.json(nd.body, { status: nd.status })
  }
  const body = await request.json().catch(() => ({})) as { text?: unknown; isPinned?: unknown }
  const isPinMutation = typeof body.isPinned === "boolean"
  const text = String(body.text ?? "").trim()
  if (!isPinMutation && (!text || text.length > 2000)) {
    return NextResponse.json({ ok: false, error: "INVALID_COMMENT_TEXT" }, { status: 400 })
  }
  const result = isPinMutation
    ? await socialRpc("gh_comment_pin_set", { p_post_id: postId, p_comment_id: cid, p_actor_id: auth.userId, p_pinned: body.isPinned })
    : await socialRpc("gh_comment_edit", { p_post_id: postId, p_comment_id: cid, p_actor_id: auth.userId, p_text: text })
  const data = (result.data || {}) as { ok?: boolean; error?: string; text?: string; isEdited?: boolean; editedAt?: number; isPinned?: boolean; pinnedAt?: number | null }
  if (!result.ok || data.ok !== true) {
    const code = String(data.error || result.error || "COMMENT_UPDATE_FAILED")
    const status = code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" || code === "POST_NOT_FOUND" ? 404 : code === "INVALID" ? 400 : 503
    return NextResponse.json({ ok: false, durable: false, error: code }, { status, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ ok: true, durable: true, ...(isPinMutation
    ? { isPinned: Boolean(data.isPinned), pinnedAt: data.pinnedAt ?? null }
    : { text: data.text || text, isEdited: true, editedAt: data.editedAt ?? Date.now() }) }, { headers: { "Cache-Control": "no-store" } })
}
