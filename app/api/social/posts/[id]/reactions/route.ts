/**
 * POST /api/social/posts/[id]/reactions — toggle a durable reaction for session user.
 * Body: { reaction?: DurableReactionType } — defaults to "like".
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { isDurableReactionType, normalizeReactionType } from "@/lib/social/reactions"
import { emitSocialNotification, lookupPostAuthor } from "@/lib/server/social/notifications"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { canViewSocialPost } from "@/lib/server/social/post-visibility"

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
  if (!postId || postId.length > 128) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  const canView = await canViewSocialPost(auth.userId, postId)
  if (canView === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!canView) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })

  const parsedBody = await readBoundedJson(request, 4096)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
  const reaction = normalizeReactionType(typeof parsedBody.value.reaction === "string" ? parsedBody.value.reaction : undefined)

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Post reaction", {
      extra: {
        reaction,
        active: false,
        liked: false,
        likeCount: null,
      },
    })
    return NextResponse.json(nd.body, { status: nd.status })
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
      data?.error === "NOT_FOUND" ? 404
        : data?.error === "FORBIDDEN" ? 403
          : data?.error === "INVALID_REACTION" ? 400 : 503
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "REACTION_FAILED" },
      { status }
    )
  }
  const active = data?.active !== undefined ? Boolean(data.active) : Boolean(data?.liked)
  // Every active reaction is meaningful feedback. Toggle-off never emits;
  // the durable dedupe key is scoped to actor + post + reaction kind.
  if (active) {
    void (async () => {
      const authorId = await lookupPostAuthor(postId)
      if (!authorId || authorId === auth.userId) return
      await emitSocialNotification({
        recipientUserId: authorId,
        actorUserId: auth.userId,
        type: "post_like",
        entityType: "post",
        entityId: postId,
        title: reaction === "like" ? "New like on your post" : "New reaction on your post",
        body: reaction === "like" ? "Someone liked your post" : `Someone reacted with ${reaction} on your post`,
        dedupeKey: `reaction:${auth.userId}:${postId}:${reaction}`,
        metadata: { postId, reaction, category: "social" },
      })
    })()
  }
  let reactionCounts: Record<string, number> | undefined
  let viewerReactions: string[] | undefined
  try {
    // Use the canonical bounded aggregate RPC instead of scanning reaction rows
    // through PostgREST. A fixed row limit silently under-counted popular posts.
    const engagement = await socialRpc("gh_post_feed_engagement_batch", {
      p_post_ids: [postId],
      p_viewer_id: auth.userId,
    })
    const rows = Array.isArray(engagement.data) ? engagement.data : []
    const post = rows.find((row: unknown) => Boolean(row && typeof row === "object" && String((row as { postId?: unknown }).postId || "") === postId)) as {
      reactionCounts?: unknown
      viewerReactions?: unknown
    } | undefined
    if (engagement.ok && post) {
      const counts = post.reactionCounts
      if (counts && typeof counts === "object" && !Array.isArray(counts)) {
        reactionCounts = {}
        for (const [kind, count] of Object.entries(counts as Record<string, unknown>)) {
          const numeric = Number(count)
          if (isDurableReactionType(kind) && Number.isSafeInteger(numeric) && numeric >= 0) reactionCounts[kind] = numeric
        }
      }
      if (Array.isArray(post.viewerReactions)) {
        viewerReactions = post.viewerReactions
          .filter((kind): kind is string => typeof kind === "string")
          .filter(isDurableReactionType)
      }
    }
  } catch { /* reaction mutation already succeeded; aggregate hydration is best effort */ }

  return NextResponse.json({
    ok: true,
    durable: true,
    reaction: data?.reaction || reaction,
    active,
    liked: reaction === "like" ? active : Boolean(data?.liked),
    likeCount: data?.likeCount ?? null,
    ...(reactionCounts ? { reactionCounts, viewerReactions: viewerReactions || [] } : {}),
  }, { headers: { "Cache-Control": "no-store" } })
}
