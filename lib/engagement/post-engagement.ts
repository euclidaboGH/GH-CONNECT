/**
 * Phase 1 — Unified post engagement bus.
 * Single channel so Feed and Profile (and any other surface) share vote/comment counts.
 * Server remains authoritative; this only propagates known server/local results.
 * Never invents balances, GHC, or vote totals.
 */

export type PostEngagementDetail = {
  postId: string
  kind: "curation" | "comment" | "save" | "share" | "view" | "edit" | "reaction"
  choice?: "upvote" | "downvote" | "neutral"
  upvoteCount?: number
  downvoteCount?: number
  /** Signed delta for comment count (e.g. +1 on add, -1 on delete) */
  commentDelta?: number
  commentCount?: number
  saved?: boolean
  /** Authoritative like/reaction total when server returns it */
  likeCount?: number
  likedByMe?: boolean
  reactionCounts?: Record<string, number>
  viewerReactions?: string[]
  shareCount?: number
}

export const POST_ENGAGEMENT_EVENT = "ghc:post-engagement" as const

export function broadcastPostEngagement(detail: PostEngagementDetail): void {
  if (typeof window === "undefined") return
  const postId = String(detail.postId || "").trim()
  if (!postId) return
  try {
    window.dispatchEvent(
      new CustomEvent(POST_ENGAGEMENT_EVENT, {
        detail: { ...detail, postId },
      }),
    )
  } catch {
    /* fail-soft */
  }
}

/** Normalize engagement metrics to full numbers (never partial undefined fields). */
export function normalizeEngagementMetrics(
  prev: {
    likes?: number
    comments?: number
    shares?: number
    views?: number
    saves?: number
    clicks?: number
    avgEngagementTime?: number
  } | null | undefined,
  patch?: Partial<{
    likes: number
    comments: number
    shares: number
    views: number
    saves: number
    clicks: number
    avgEngagementTime: number
  }>,
) {
  return {
    likes: Number(patch?.likes ?? prev?.likes ?? 0),
    comments: Number(patch?.comments ?? prev?.comments ?? 0),
    shares: Number(patch?.shares ?? prev?.shares ?? 0),
    views: Number(patch?.views ?? prev?.views ?? 0),
    saves: Number(patch?.saves ?? prev?.saves ?? 0),
    clicks: Number(patch?.clicks ?? prev?.clicks ?? 0),
    avgEngagementTime: Number(patch?.avgEngagementTime ?? prev?.avgEngagementTime ?? 0),
  }
}
