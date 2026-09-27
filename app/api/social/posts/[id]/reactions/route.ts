/**
 * POST /api/social/posts/[id]/reactions — toggle a durable reaction for session user.
 * Body: { reaction?: DurableReactionType } — defaults to "like".
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { normalizeReactionType } from "@/lib/social/reactions"
import { emitSocialNotification, lookupPostAuthor } from "@/lib/server/social/notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`reaction:${auth.userId}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  let body: { reaction?: string } = {}
  try {
    body = (await request.json()) as { reaction?: string }
  } catch {
    body = {}
  }
  const reaction = normalizeReactionType(body.reaction)

  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      reaction,
      active: true,
      liked: reaction === "like",
      likeCount: null,
    })
  }

  const result = await socialRpc("gh_reaction_toggle", {
    p_post_id: postId,
    p_user_id: auth.userId,
    p_reaction: reaction,
  })
  const data = result.data as {
    ok?: boolean
    liked?: boolean
    active?: boolean
    reaction?: string
    likeCount?: number
    error?: string
  }
  if (!result.ok || data?.ok === false) {
    const status =
      data?.error === "NOT_FOUND" ? 404 : data?.error === "INVALID_REACTION" ? 400 : 503
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "REACTION_FAILED" },
      { status }
    )
  }
  const active = data?.active !== undefined ? Boolean(data.active) : Boolean(data?.liked)
  // Notify post author only when reaction is active (not toggle-off)
  if (active && reaction === "like") {
    void (async () => {
      const authorId = await lookupPostAuthor(postId)
      if (!authorId || authorId === auth.userId) return
      await emitSocialNotification({
        recipientUserId: authorId,
        actorUserId: auth.userId,
        type: "post_like",
        entityType: "post",
        entityId: postId,
        title: "New like",
        body: "Someone liked your post",
        dedupeKey: `like:${auth.userId}:${postId}`,
        metadata: { postId, reaction },
      })
    })()
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    reaction: data?.reaction || reaction,
    active,
    liked: reaction === "like" ? active : Boolean(data?.liked),
    likeCount: data?.likeCount ?? null,
  })
}
