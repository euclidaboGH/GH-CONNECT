/**
 * GET /api/social/profile/:userId/posts
 * Viewer-authorized, paginated profile timeline and media search.
 * Authorization is enforced again inside the service-role RPC; client-supplied
 * viewer IDs are never accepted.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRest, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableReadResponse } from "@/lib/server/production-guard"
import { filterVisibleSocialPosts } from "@/lib/server/social/post-visibility"
import { loadCommentReactionState } from "@/lib/server/social/comment-reactions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


type ProfileCommentRow = {
  id?: string; post_id?: string; author_id?: string; author_name?: string;
  author_photo?: string; text?: string; parent_id?: string | null; created_at?: string; media?: unknown; is_edited?: boolean; edited_at?: string | null; is_pinned?: boolean; pinned_at?: string | null;
}
type ProfileCurationRow = { post_id?: string; user_id?: string; choice?: string }
type ProfileReactionRow = { post_id?: string; user_id?: string; reaction?: string }
function profilePostIdsFilter(ids: string[]): string {
  return `in.(${ids.map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",")})`
}

/** Rehydrate durable comments and curation for profile posts, just as the feed does. */
async function hydrateProfileEngagement(posts: unknown[], viewerId: string): Promise<unknown[]> {
  const rows = posts.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
  const ids = Array.from(new Set(rows.map((post) => String(post.id || "").trim()).filter(Boolean))).slice(0, 50)
  if (!ids.length) return posts
  const filter = profilePostIdsFilter(ids)
  const commentsQuery = new URLSearchParams({
    post_id: filter, deleted_at: "is.null",
    select: "id,post_id,author_id,author_name,author_photo,text,parent_id,created_at,media,is_edited,edited_at,is_pinned,pinned_at",
    order: "created_at.desc", limit: String(Math.min(ids.length * 12, 600)),
  })
  const curationQuery = new URLSearchParams({
    post_id: filter, select: "post_id,user_id,choice", limit: "10000",
  })
  const reactionsQuery = new URLSearchParams({
    post_id: filter, select: "post_id,user_id,reaction", limit: "5000",
  })
  const [commentsResult, curationResult, reactionsResult] = await Promise.all([
    socialRest<ProfileCommentRow[]>(`gh_post_comments?${commentsQuery.toString()}`),
    socialRest<ProfileCurationRow[]>(`gh_post_curations?${curationQuery.toString()}`),
    socialRest<ProfileReactionRow[]>(`gh_post_reactions?${reactionsQuery.toString()}`),
  ])
  const commentReactionStates = commentsResult.ok && Array.isArray(commentsResult.data)
    ? await loadCommentReactionState(commentsResult.data, viewerId)
    : new Map()
  const commentsByPost = new Map<string, ProfileCommentRow[]>()
  if (commentsResult.ok && Array.isArray(commentsResult.data)) {
    for (const comment of commentsResult.data) {
      const postId = String(comment.post_id || "")
      if (!ids.includes(postId)) continue
      const bucket = commentsByPost.get(postId) || []
      if (bucket.length < 3) bucket.push(comment)
      commentsByPost.set(postId, bucket)
    }
  }
  const reactionsByPost = new Map<string, Record<string, number>>()
  const viewerReactionsByPost = new Map<string, string[]>()
  if (reactionsResult.ok && Array.isArray(reactionsResult.data)) {
    for (const row of reactionsResult.data) {
      const postId = String(row.post_id || "")
      const reaction = String(row.reaction || "").trim().toLowerCase()
      if (!ids.includes(postId) || !reaction) continue
      const counts = reactionsByPost.get(postId) || {}
      counts[reaction] = (counts[reaction] || 0) + 1
      reactionsByPost.set(postId, counts)
      if (String(row.user_id || "") === viewerId) {
        const mine = viewerReactionsByPost.get(postId) || []
        if (!mine.includes(reaction)) mine.push(reaction)
        viewerReactionsByPost.set(postId, mine)
      }
    }
  }
  const votesByPost = new Map<string, { up: number; down: number; mine?: string }>()
  const votesAvailable = curationResult.ok && Array.isArray(curationResult.data)
  if (votesAvailable) {
    for (const vote of curationResult.data || []) {
      const postId = String(vote.post_id || "")
      const choice = String(vote.choice || "").toLowerCase()
      if (!ids.includes(postId)) continue
      const bucket = votesByPost.get(postId) || { up: 0, down: 0 }
      if (choice === "upvote") bucket.up += 1
      if (choice === "downvote") bucket.down += 1
      if (String(vote.user_id || "") === viewerId && (choice === "upvote" || choice === "downvote")) bucket.mine = choice
      votesByPost.set(postId, bucket)
    }
  }
  return rows.map((post) => {
    const id = String(post.id || "")
    const comments = (commentsByPost.get(id) || []).slice().reverse().map((comment) => ({
      id: String(comment.id || ""), postId: id,
      authorId: String(comment.author_id || ""), authorName: String(comment.author_name || "Member"),
      authorPhoto: String(comment.author_photo || ""), text: String(comment.text || ""),
      createdAt: comment.created_at ? new Date(comment.created_at).getTime() : 0,
      parentId: comment.parent_id ? String(comment.parent_id) : undefined,
      replyTo: comment.parent_id ? String(comment.parent_id) : undefined,
      mediaAttachments: Array.isArray(comment.media) ? comment.media : [],
      isEdited: Boolean(comment.is_edited),
      editedAt: comment.edited_at ? new Date(comment.edited_at).getTime() : undefined,
      isPinned: Boolean(comment.is_pinned),
      ...(commentReactionStates.has(String(comment.id || "")) ? {
        reactionCounts: commentReactionStates.get(String(comment.id || ""))!.reactionCounts,
        viewerReactions: commentReactionStates.get(String(comment.id || ""))!.viewerReactions,
      } : {}),
    })).filter((comment) => comment.id)
    const vote = votesByPost.get(id)
    const existingCommentCount = Number(post.commentCount ?? post.comment_count ?? 0) || 0
    const commentCount = Math.max(existingCommentCount, comments.length)
    const upvoteCount = votesAvailable ? (vote?.up || 0) : (Number(post.upvoteCount ?? post.upvote_count ?? 0) || 0)
    const downvoteCount = votesAvailable ? (vote?.down || 0) : (Number(post.downvoteCount ?? post.downvote_count ?? 0) || 0)
    const rawChoice = String(post.viewerCurationChoice ?? post.viewer_curation_choice ?? "").toLowerCase()
    const viewerCurationChoice = votesAvailable
      ? vote?.mine
      : (rawChoice === "upvote" || rawChoice === "downvote" ? rawChoice : undefined)
    const likes = Number(post.likes ?? post.likeCount ?? post.like_count ?? 0) || 0
    const shares = Number(post.shares ?? post.shareCount ?? post.share_count ?? 0) || 0
    return {
      ...post, comments, commentCount, upvoteCount, downvoteCount, viewerCurationChoice,
      reactionCounts: reactionsByPost.get(id) || {},
      viewerReactions: viewerReactionsByPost.get(id) || [],
      engagement: {
        ...((post.engagement && typeof post.engagement === "object") ? post.engagement as Record<string, unknown> : {}),
        likes, comments: commentCount, shares,
      },
    }
  })
}

export async function GET(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })

  const { userId: rawUserId } = await ctx.params
  const profileId = String(rawUserId || "").trim()
  if (!profileId || profileId.length > 160 || /[\u0000-\u001f]/.test(profileId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PROFILE_ID" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const rl = checkRateLimit(`profile-content:${auth.userId}`, 90, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } })

  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Profile content library", { posts: [], hasMore: false, nextBefore: null })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }

  const url = new URL(request.url)
  const limitRaw = Number(url.searchParams.get("limit") || 30)
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30
  const beforeRaw = url.searchParams.get("before")
  const beforeIdRaw = url.searchParams.get("beforeId") || ""
  let before: number | null = null
  let beforeId: string | null = null
  if (beforeRaw !== null || beforeIdRaw !== "") {
    const parsedBefore = beforeRaw !== null && /^\d{1,16}$/.test(beforeRaw) ? Number(beforeRaw) : NaN
    if (!Number.isSafeInteger(parsedBefore) || parsedBefore <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_CONTENT_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    if (!beforeIdRaw || beforeIdRaw.length > 160 || /[\u0000-\u001f\u007f]/.test(beforeIdRaw)) {
      return NextResponse.json({ ok: false, error: "INVALID_CONTENT_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    before = parsedBefore
    beforeId = beforeIdRaw
  }
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120)
  const mediaKind = (url.searchParams.get("kind") || "all").toLowerCase()
  const allowedKinds = new Set(["all", "posts", "photos", "videos", "documents"])

  const result = await socialRpc("gh_post_list_profile_content", {
    p_viewer_id: auth.userId,
    p_profile_id: profileId,
    p_limit: limit,
    p_before_ms: before,
    p_before_id: beforeId,
    p_query: query,
    p_media_kind: allowedKinds.has(mediaKind) ? mediaKind : "all",
  })
  if (!result.ok) {
    const migrationMissing = result.status === 404
    return NextResponse.json({
      ok: false,
      error: migrationMissing ? "PROFILE_CONTENT_MIGRATION_REQUIRED" : result.error || "PROFILE_CONTENT_UNAVAILABLE",
      message: migrationMissing
        ? "Apply supabase/migrations/20261022010102_gh_profile_content_library.sql on Testnet before using profile content search."
        : "Profile content is temporarily unavailable. Please try again shortly.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  const data = result.data as { ok?: boolean; error?: string; posts?: unknown[]; hasMore?: boolean; nextBefore?: number | null; nextBeforeId?: string | null }
  if (data?.ok === false) return NextResponse.json({ ok: false, error: data.error || "PROFILE_CONTENT_UNAVAILABLE" }, { status: 400 })
  const visiblePosts = await filterVisibleSocialPosts(auth.userId, Array.isArray(data?.posts) ? data.posts : [])
  if (visiblePosts === null) return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  let hydratedPosts: unknown[] = visiblePosts
  try {
    hydratedPosts = await hydrateProfileEngagement(visiblePosts, auth.userId)
  } catch {
    // A preview failure must not hide the timeline; durable comment/vote APIs remain available.
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    posts: hydratedPosts,
    hasMore: Boolean(data?.hasMore),
    nextBefore: typeof data?.nextBefore === "number" ? data.nextBefore : null,
    nextBeforeId: typeof data?.nextBeforeId === "string" ? data.nextBeforeId : null,
  }, { headers: { "Cache-Control": "no-store" } })
}
