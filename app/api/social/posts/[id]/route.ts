/**
 * DELETE /api/social/posts/[id] — soft-delete own post only.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc, socialRest } from "@/lib/server/social/rpc"
import { nonDurableWriteResponse, nonDurableReadResponse } from "@/lib/server/production-guard"
import { canViewSocialPost } from "@/lib/server/social/post-visibility"
import { getPublicContentReward } from "@/lib/server/content-reward/store"
import { hydratePublicProfileIdentity } from "@/lib/server/identity/public-profile-hydration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(postId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Post", { post: null })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }
  const visible = await canViewSocialPost(auth.userId, postId)
  if (visible === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (!visible) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })

  const q = new URLSearchParams({
    id: `eq.${postId}`,
    deleted_at: "is.null",
    archived_at: "is.null",
    select: "id,author_id,author_name,author_photo,content,images,video,pdf,pdf_name,visibility,community_id,community_name,content_type,like_count,comment_count,share_count,upvote_count,downvote_count,is_edited,created_at,updated_at,quote_of_post_id",
    limit: "1",
  })
  const result = await socialRest<Array<Record<string, unknown>>>(`gh_posts?${q.toString()}`)
  if (!result.ok) return NextResponse.json({ ok: false, error: "POST_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const row = result.data?.[0]
  if (!row) return NextResponse.json({ ok: false, error: "POST_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } })
  const reward = await getPublicContentReward(postId).catch(() => ({ ok: false, enabled: false, status: "unavailable" }))
  const post = {
    id: String(row.id),
    authorId: String(row.author_id || ""),
    authorName: String(row.author_name || "Member"),
    authorPhoto: String(row.author_photo || ""),
    content: String(row.content || ""),
    images: Array.isArray(row.images) ? row.images : [],
    video: row.video ? String(row.video) : null,
    pdf: row.pdf ? String(row.pdf) : null,
    pdfName: row.pdf_name ? String(row.pdf_name) : null,
    visibility: String(row.visibility || "public"),
    communityId: row.community_id ? String(row.community_id) : null,
    communityName: row.community_name ? String(row.community_name) : null,
    contentType: String(row.content_type || "standard"),
    likes: Number(row.like_count || 0),
    commentCount: Number(row.comment_count || 0),
    shares: Number(row.share_count || 0),
    upvoteCount: Number(row.upvote_count || 0),
    downvoteCount: Number(row.downvote_count || 0),
    isEdited: Boolean(row.is_edited),
    createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : 0,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).getTime() : undefined,
    quoteOf: row.quote_of_post_id ? String(row.quote_of_post_id) : undefined,
    contentReward: reward.ok ? reward : undefined,
    engagement: { likes: Number(row.like_count || 0), comments: Number(row.comment_count || 0), shares: Number(row.share_count || 0), views: 0, saves: 0, clicks: 0, avgEngagementTime: 0 },
  }
  const [hydratedPost] = await hydratePublicProfileIdentity([post as unknown as Record<string, unknown>])
  return NextResponse.json({ ok: true, durable: true, post: hydratedPost }, { headers: { "Cache-Control": "no-store" } })
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Post delete")
    return NextResponse.json(nd.body, { status: nd.status })
  }

  const result = await socialRpc("gh_post_soft_delete", {
    p_post_id: postId,
    p_actor_id: auth.userId,
  })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "DELETE_FAILED" },
      { status: 503 }
    )
  }
  if (data?.error === "FORBIDDEN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  if (data?.error === "NOT_FOUND") {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
  }
  // GHPV cleanup runs inside gh_post_soft_delete (20261020). Do not expose a client cleanup RPC.
  return NextResponse.json({
    ok: true,
    durable: true,
    id: postId,
    ghpvCleaned: Boolean((data as { ghpvCleaned?: boolean })?.ghpvCleaned),
  })
}
