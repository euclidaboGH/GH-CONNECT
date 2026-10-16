/**
 * POST /api/social/posts/[id]/share — durable share edge (not a content copy).
 * Actor = session. Notifies original author once per sharer+post (dedupe).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { emitSocialNotification } from "@/lib/server/social/notifications"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthenticatedUser(_request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`share:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Share post", { extra: { postId } })
    return NextResponse.json(nd.body, { status: nd.status })
  }

  const result = await socialRpc("gh_post_share", {
    p_sharer_id: auth.userId,
    p_post_id: postId,
  })
  const data = (result.data || {}) as {
    ok?: boolean
    error?: string
    authorId?: string
    shareCount?: number
    shareId?: string
  }

  if (!result.ok || data.ok === false) {
    const code = String(data.error || result.error || "SHARE_FAILED")
    const status =
      code === "NOT_FOUND" || code === "DELETED"
        ? 404
        : code === "BLOCKED"
          ? 403
          : 503
    return NextResponse.json({ ok: false, error: code }, { status })
  }

  const authorId = data.authorId ? String(data.authorId) : ""
  if (authorId && authorId !== auth.userId) {
    void emitSocialNotification({
      recipientUserId: authorId,
      actorUserId: auth.userId,
      type: "share",
      entityType: "post",
      entityId: postId,
      title: "Post shared",
      body: "Someone shared your post",
      dedupeKey: `share:${auth.userId}:${postId}`,
      metadata: { kind: "share", postId },
    })
  }

  // Attention share signal (measurement only)
  void socialRpc("gh_content_event_record", {
    p_content_id: postId,
    p_actor_id: auth.userId,
    p_event_type: "share",
    p_window_key: `share:${auth.userId}:${postId}`,
  }).catch(() => null)

  return NextResponse.json({
    ok: true,
    durable: true,
    postId,
    shareId: data.shareId,
    shareCount: data.shareCount ?? null,
  })
}
