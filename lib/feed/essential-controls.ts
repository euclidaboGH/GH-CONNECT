/**
 * Section 1 — Feed & Social essential controls (0.338.15)
 * Single place for feed honesty invariants used by ranking and UI.
 */

export const FEED_PAGE_SIZE_MAX = 30
export const FEED_PAGE_SIZE_DEFAULT = 15
export const FEED_PREFETCH_MEDIA_MAX = 6

/** Posts that must never appear in public ranked lanes. */
export function isExcludedFromPublicFeed(post: {
  isDraft?: boolean
  isScheduled?: boolean
  deletedAt?: string | number | null
  authorId?: string | null
}, blockedMuted: Set<string>): boolean {
  if (post.isDraft || post.isScheduled) return true
  if (post.deletedAt) return true
  const author = String(post.authorId || "").trim()
  if (author && blockedMuted.has(author)) return true
  return false
}

/** Clamp requested page size for feed APIs. */
export function clampFeedPageSize(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) return FEED_PAGE_SIZE_DEFAULT
  return Math.min(FEED_PAGE_SIZE_MAX, Math.max(1, Math.floor(n)))
}

/** True when a ranking reason is an error, not a success score. */
export function isFeedRankingErrorReason(reason: { category?: string } | null | undefined): boolean {
  return String(reason?.category || "").toLowerCase() === "error"
}
