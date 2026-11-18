/**
 * Phase 1 — marketplace review quality (display layer only).
 *
 * Reviews are created server/domain-side and are already gated to completed
 * buyer orders. This module never creates, edits or deletes a review and never
 * changes a stored rating. It decides which already-stored reviews are shown as
 * substantive, and summarises ratings from verified (order-linked) reviews only.
 */

export interface ReviewLike {
  id: string
  orderId?: string | null
  reviewerId?: string | null
  rating: number
  text?: string | null
  createdAt?: number
}

export type ReviewQualityFlag = "unverified" | "too_short" | "no_letters" | "repeated_characters" | "duplicate_text"

export interface ReviewAssessment<T extends ReviewLike = ReviewLike> {
  review: T
  verified: boolean
  flags: ReviewQualityFlag[]
  /** True when the written text is substantive enough to feature. */
  featured: boolean
}

export const MIN_FEATURED_REVIEW_CHARS = 12

function normalizeText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
}

function hasLetters(text: string): boolean {
  return /\p{L}/u.test(text)
}

function isRepeatedCharacters(text: string): boolean {
  const compact = text.replace(/\s+/g, "")
  if (compact.length < 4) return false
  return new Set(Array.from(compact)).size <= 2
}

/** A review counts as verified only when it is linked to an order. */
export function isVerifiedReview(review: ReviewLike): boolean {
  return typeof review.orderId === "string" && review.orderId.trim().length > 0
}

export function isValidRating(rating: unknown): rating is number {
  return typeof rating === "number" && Number.isFinite(rating) && rating >= 1 && rating <= 5
}

export function assessReviews<T extends ReviewLike>(reviews: readonly T[]): ReviewAssessment<T>[] {
  const seenByReviewer = new Map<string, Set<string>>()
  return reviews.map((review) => {
    const flags: ReviewQualityFlag[] = []
    const verified = isVerifiedReview(review)
    if (!verified) flags.push("unverified")
    const text = normalizeText(String(review.text ?? ""))
    if (text.length < MIN_FEATURED_REVIEW_CHARS) flags.push("too_short")
    if (text && !hasLetters(text)) flags.push("no_letters")
    if (text && isRepeatedCharacters(text)) flags.push("repeated_characters")
    if (text) {
      const key = String(review.reviewerId ?? "anonymous")
      const seen = seenByReviewer.get(key) ?? new Set<string>()
      if (seen.has(text)) flags.push("duplicate_text")
      seen.add(text)
      seenByReviewer.set(key, seen)
    }
    return { review, verified, flags, featured: verified && flags.length === 0 }
  })
}

/** Reviews worth featuring, newest first, bounded for mobile. */
export function featuredReviews<T extends ReviewLike>(reviews: readonly T[], limit = 3): T[] {
  const safeLimit = Math.max(0, Math.min(10, Math.floor(Number.isFinite(limit) ? limit : 3)))
  return assessReviews(reviews)
    .filter((entry) => entry.featured)
    .map((entry) => entry.review)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.id.localeCompare(b.id))
    .slice(0, safeLimit)
}

export interface RatingSummary {
  count: number
  average: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

/** Summary counts only verified, validly rated reviews. */
export function summarizeVerifiedRatings(reviews: readonly ReviewLike[]): RatingSummary {
  const distribution: RatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let count = 0
  for (const review of reviews) {
    if (!isVerifiedReview(review) || !isValidRating(review.rating)) continue
    const bucket = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5
    distribution[bucket] += 1
    total += review.rating
    count += 1
  }
  return { count, average: count ? Math.round((total / count) * 10) / 10 : 0, distribution }
}
