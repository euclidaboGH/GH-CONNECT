/**
 * GET /api/social/feed — durable feed for authenticated viewer.
 * Server derives actor from session; client cannot impersonate.
 * Post-filters muted authors when mute rows are available.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc, socialRest } from "@/lib/server/social/rpc"
import { nonDurableReadResponse } from "@/lib/server/production-guard"
import { filterVisibleSocialPosts } from "@/lib/server/social/post-visibility"
import { loadCommentReactionState } from "@/lib/server/social/comment-reactions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function mutedAuthorIds(viewerId: string): Promise<Set<string>> {
  const out = new Set<string>()
  try {
    const q = `gh_user_mutes?muter_id=eq.${encodeURIComponent(viewerId)}&select=muted_id`
    const result = await socialRest<Array<{ muted_id: string }>>(q)
    if (result.ok && Array.isArray(result.data)) {
      for (const row of result.data) {
        const id = String(row.muted_id || "").trim()
        if (id) out.add(id)
      }
    }
  } catch {
    /* feed still returns; mute filter best-effort */
  }
  return out
}

type FeedCommentRow = {
  id?: string
  post_id?: string
  author_id?: string
  author_name?: string
  author_photo?: string
  text?: string
  parent_id?: string | null
  created_at?: string
  media?: unknown
  is_edited?: boolean
  edited_at?: string | null
  is_pinned?: boolean
  pinned_at?: string | null
}

type FeedReactionRow = { post_id?: string; user_id?: string; reaction?: string }

function postIdsFilter(ids: string[]): string {
  // Post IDs are text keys; quoted PostgREST `in` values safely support punctuation.
  return `in.(${ids.map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",")})`
}

/** Batch-hydrate public engagement previews so the feed never waits for a user to tap first. */
async function hydrateFeedEngagement(posts: unknown[], viewerId: string): Promise<unknown[]> {
  const rows = posts.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
  const ids = Array.from(new Set(rows.map((p) => String(p.id || "").trim()).filter(Boolean))).slice(0, 50)
  if (!ids.length) return posts

  const q = new URLSearchParams()
  q.set("post_id", postIdsFilter(ids))
  q.set("deleted_at", "is.null")
  q.set("select", "id,post_id,author_id,author_name,author_photo,text,parent_id,created_at,media,is_edited,edited_at,is_pinned,pinned_at")
  q.set("order", "created_at.desc")
  q.set("limit", String(Math.min(ids.length * 12, 600)))
  const rq = new URLSearchParams()
  rq.set("post_id", postIdsFilter(ids))
  rq.set("select", "post_id,user_id,reaction")
  rq.set("limit", "2000")

  const [commentsResult, reactionsResult] = await Promise.all([
    socialRest<FeedCommentRow[]>(`gh_post_comments?${q.toString()}`),
    socialRest<FeedReactionRow[]>(`gh_post_reactions?${rq.toString()}`),
  ])
  const commentsByPost = new Map<string, FeedCommentRow[]>()
  if (commentsResult.ok && Array.isArray(commentsResult.data)) {
    for (const comment of commentsResult.data) {
      const postId = String(comment.post_id || "")
      if (!postId || !ids.includes(postId)) continue
      const bucket = commentsByPost.get(postId) || []
      if (bucket.length < 3) bucket.push(comment)
      commentsByPost.set(postId, bucket)
    }
  }
  const commentReactionStates = commentsResult.ok && Array.isArray(commentsResult.data)
    ? await loadCommentReactionState(commentsResult.data, viewerId)
    : new Map()
  const countsByPost = new Map<string, Record<string, number>>()
  const mineByPost = new Map<string, string[]>()
  if (reactionsResult.ok && Array.isArray(reactionsResult.data)) {
    for (const row of reactionsResult.data) {
      const postId = String(row.post_id || "")
      const reaction = String(row.reaction || "").trim().toLowerCase()
      if (!postId || !reaction || !ids.includes(postId)) continue
      const counts = countsByPost.get(postId) || {}
      counts[reaction] = (counts[reaction] || 0) + 1
      countsByPost.set(postId, counts)
      if (String(row.user_id || "") === viewerId) {
        const mine = mineByPost.get(postId) || []
        if (!mine.includes(reaction)) mine.push(reaction)
        mineByPost.set(postId, mine)
      }
    }
  }

  // Curation (upvote/downvote) — independent of emoji reactions.
  type FeedCurationRow = { post_id?: string; user_id?: string; choice?: string }
  const curationByPost = new Map<string, { up: number; down: number; mine?: string }>()
  // Always reconcile curation from the durable vote table. Older feed RPCs can
  // return stale zero-valued counters and omit the viewer's choice; treating
  // those fields as present made votes appear to disappear after a refresh.
  let curationReadSucceeded = false
  if (ids.length) {
    const cq = new URLSearchParams()
    cq.set("post_id", postIdsFilter(ids))
    cq.set("select", "post_id,user_id,choice")
    cq.set("limit", "10000")
    const curationResult = await socialRest<FeedCurationRow[]>(`gh_post_curations?${cq.toString()}`)
    if (curationResult.ok && Array.isArray(curationResult.data)) {
      curationReadSucceeded = true
      for (const row of curationResult.data) {
        const postId = String(row.post_id || "")
        const choice = String(row.choice || "").trim().toLowerCase()
        if (!postId || !ids.includes(postId)) continue
        const bucket = curationByPost.get(postId) || { up: 0, down: 0 }
        if (choice === "upvote") bucket.up += 1
        else if (choice === "downvote") bucket.down += 1
        if (String(row.user_id || "") === viewerId && (choice === "upvote" || choice === "downvote")) {
          bucket.mine = choice
        }
        curationByPost.set(postId, bucket)
      }
    }
  }

  return rows.map((post) => {
    const id = String(post.id || "")
    const comments = (commentsByPost.get(id) || []).slice().reverse().map((comment) => ({
      id: String(comment.id || ""),
      authorId: String(comment.author_id || ""),
      authorName: String(comment.author_name || "Member"),
      authorPhoto: String(comment.author_photo || ""),
      text: String(comment.text || ""),
      createdAt: comment.created_at ? new Date(comment.created_at).getTime() : Date.now(),
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
    const reactionCounts = countsByPost.get(id) || {}
    const likes = Number(post.likes ?? post.likeCount ?? post.like_count ?? 0) || 0
    const commentCount = Math.max(
      Number(post.commentCount ?? post.comment_count ?? 0) || 0,
      comments.length,
    )
    const shares = Number(post.shares ?? post.shareCount ?? post.share_count ?? 0) || 0
    const curation = curationByPost.get(id)
    const upvoteCount = curationReadSucceeded
      ? (curation?.up || 0)
      : (Number(post.upvoteCount ?? post.upvote_count ?? 0) || 0)
    const downvoteCount = curationReadSucceeded
      ? (curation?.down || 0)
      : (Number(post.downvoteCount ?? post.downvote_count ?? 0) || 0)
    const rpcChoice = String(post.viewerCurationChoice ?? post.viewer_curation_choice ?? "").toLowerCase()
    const viewerCurationChoice = curationReadSucceeded
      ? curation?.mine
      : (rpcChoice === "upvote" || rpcChoice === "downvote" ? rpcChoice : undefined)
    return {
      ...post,
      comments,
      commentCount,
      reactionCounts,
      viewerReactions: mineByPost.get(id) || [],
      upvoteCount,
      downvoteCount,
      viewerCurationChoice:
        viewerCurationChoice === "upvote" || viewerCurationChoice === "downvote"
          ? viewerCurationChoice
          : undefined,
      engagement: {
        ...((post.engagement && typeof post.engagement === "object") ? post.engagement as Record<string, unknown> : {}),
        likes,
        comments: commentCount,
        shares,
        views: Number(post.viewCount ?? post.view_count ?? 0) || 0,
      },
    }
  })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Social feed", { posts: [], message: "SOCIAL_DB_UNAVAILABLE" })
    return NextResponse.json(nd.body, {
      status: nd.status,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const url = new URL(request.url)
  const rawLimit = url.searchParams.get("limit")
  const parsedLimit = rawLimit === null ? 40 : Number(rawLimit)
  if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
    return NextResponse.json({ ok: false, error: "INVALID_FEED_LIMIT" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const limit = parsedLimit
  const before = url.searchParams.get("before")
  const beforeIdRaw = (url.searchParams.get("beforeId") || "").trim()
  const hasCursor = before !== null || beforeIdRaw !== ""
  const beforeMs = before !== null && /^\d{1,16}$/.test(before) ? Number(before) : null
  if (hasCursor && (before === null || beforeMs === null || !Number.isSafeInteger(beforeMs) || beforeMs <= 0 || !beforeIdRaw || beforeIdRaw.length > 160 || /[\u0000-\u001f\u007f]/.test(beforeIdRaw))) {
    return NextResponse.json({ ok: false, error: "INVALID_FEED_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  // V3 applies canonical visibility in the database before returning post bodies,
  // including mutual-follow and active-community membership rules. Keep stable
  // cursor fallbacks for staged rollout, with a second server-side visibility gate below.
  let result = await socialRpc("gh_post_list_feed_v3", {
    p_viewer_id: auth.userId,
    p_limit: limit,
    p_before_ms: hasCursor ? beforeMs : null,
    p_before_id: hasCursor ? beforeIdRaw : null,
  })
  let stableCursor = result.ok
  if (!result.ok) {
    result = await socialRpc("gh_post_list_feed_v2", {
      p_viewer_id: auth.userId,
      p_limit: limit,
      p_before_ms: hasCursor ? beforeMs : null,
      p_before_id: hasCursor ? beforeIdRaw : null,
    })
    stableCursor = result.ok
  }
  if (!result.ok) {
    result = await socialRpc("gh_post_list_feed", {
      p_viewer_id: auth.userId,
      p_limit: limit,
      p_before_ms: hasCursor ? beforeMs : null,
    })
    stableCursor = false
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: true,
        durable: false,
        posts: [],
        message: result.error || "FEED_RPC_UNAVAILABLE",
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  const payload = result.data as { ok?: boolean; posts?: unknown[] }
  const rawPagePosts = Array.isArray(payload?.posts) ? payload.posts : []
  let posts = rawPagePosts

  // Re-check canonical visibility before any post payload reaches the client.
  // This covers community-bound posts and mutuals even while legacy RPCs remain installed.
  const visiblePosts = await filterVisibleSocialPosts(auth.userId, posts)
  if (visiblePosts === null) {
    return NextResponse.json({ ok: false, error: "POST_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  posts = visiblePosts

  // Server-side mute enforcement (canonical visibility has already checked blocks)
  const muted = await mutedAuthorIds(auth.userId)
  if (muted.size > 0) {
    posts = posts.filter((p) => {
      const authorId = String(
        (p as { authorId?: string; author_id?: string }).authorId ||
          (p as { author_id?: string }).author_id ||
          ""
      )
      return !authorId || !muted.has(authorId)
    })
  }

  // Engagement counts and recent comment previews are hydrated in two batched reads,
  // never one request per post. Fail-soft: feed posts remain usable if previews are unavailable.
  try {
    posts = await hydrateFeedEngagement(posts, auth.userId)
  } catch {
    /* engagement previews are an enhancement; never fail the feed for them */
  }

  // Advance using the last raw server row, not the last visible/mute-filtered row,
  // so a page containing hidden or muted posts cannot cause pagination to loop.
  const last = rawPagePosts.length ? (rawPagePosts[rawPagePosts.length - 1] as { id?: string; createdAt?: number }) : null
  const nextCursor = last?.id && Number.isFinite(Number(last?.createdAt))
    ? { before: Number(last.createdAt), beforeId: String(last.id) }
    : null

  return NextResponse.json(
    { ok: true, durable: true, posts, mutedFiltered: muted.size, nextCursor, stableCursor },
    { headers: { "Cache-Control": "no-store" } }
  )
}
