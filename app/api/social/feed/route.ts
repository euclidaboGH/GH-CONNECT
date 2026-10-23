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

  // Phase 37: one service-role RPC replaces the previous multi-query fan-out
  // (comments + comment reactions + post reactions + curations). This keeps the
  // feed payload identical while materially reducing database round trips.
  const batch = await socialRpc("gh_post_feed_engagement_batch", {
    p_post_ids: ids,
    p_viewer_id: viewerId,
  })
  if (batch.ok && Array.isArray(batch.data)) {
    const byPost = new Map<string, Record<string, unknown>>()
    for (const row of batch.data as Array<Record<string, unknown>>) {
      const id = String(row.postId || "").trim()
      if (id) byPost.set(id, row)
    }
    return rows.map((post) => {
      const id = String(post.id || "")
      const extra = byPost.get(id)
      if (!extra) return post
      const comments = Array.isArray(extra.comments) ? extra.comments : []
      const reactionCounts = extra.reactionCounts && typeof extra.reactionCounts === "object"
        ? extra.reactionCounts as Record<string, number>
        : {}
      const viewerReactions = Array.isArray(extra.viewerReactions) ? extra.viewerReactions : []
      const likes = Number(post.likes ?? post.likeCount ?? post.like_count ?? reactionCounts.like ?? 0) || 0
      const commentCount = Math.max(Number(post.commentCount ?? post.comment_count ?? 0) || 0, comments.length)
      const shares = Number(post.shares ?? post.shareCount ?? post.share_count ?? 0) || 0
      const viewerCurationChoice = String(extra.viewerCurationChoice || "").toLowerCase()
      return {
        ...post,
        comments,
        commentCount,
        reactionCounts,
        viewerReactions,
        upvoteCount: Number(extra.upvoteCount ?? 0) || 0,
        downvoteCount: Number(extra.downvoteCount ?? 0) || 0,
        viewerCurationChoice: viewerCurationChoice === "upvote" || viewerCurationChoice === "downvote"
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

  throw new Error("FEED_ENGAGEMENT_BATCH_RPC_UNAVAILABLE")
}

/* Legacy per-table engagement hydration was retired in Phase 39. The canonical
 * batch RPC is now the only production engagement authority. */
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

  // Final canonical feed contract. Historical v2/v1 RPCs are no longer
  // runtime fallbacks; schema drift must fail closed and be fixed at release.
  const result = await socialRpc("gh_post_list_feed_v3", {
    p_viewer_id: auth.userId,
    p_limit: limit,
    p_before_ms: hasCursor ? beforeMs : null,
    p_before_id: hasCursor ? beforeIdRaw : null,
  })
  const stableCursor = result.ok

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
