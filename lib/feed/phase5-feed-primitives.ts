/** Small pure helpers shared by feed ranking and dependency-free regression tests. */

export type FeedOrderKey = { createdAt?: number | null; id: string }

export function extractHashtags(content: string): string[] {
  const matches = String(content || "").match(/#([\p{L}\p{N}][\p{L}\p{N}\p{M}_]{1,31})/gu) || []
  return [...new Set(matches.map((tag) => tag.slice(1).normalize("NFKC").toLocaleLowerCase()))]
}

export function normalizeInterest(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").toLocaleLowerCase().replace(/^#/, "").replace(/[_-]+/g, " ").replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ").replace(/\s+/g, " ").trim()
    : ""
}

export function containsWholeInterest(content: string, interest: string): boolean {
  const normalizedContent = String(content || "").normalize("NFKC").toLocaleLowerCase().replace(/[_-]+/g, " ")
  const normalizedTerm = normalizeInterest(interest)
  if (!normalizedContent || !normalizedTerm) return false
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
  try { return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(normalizedContent) }
  catch { return normalizedContent.includes(normalizedTerm) }
}

export function matchPostInterests(
  content: string,
  hashtags: string[] | undefined,
  interests: string[],
  maxMatches = 3,
): string[] {
  const tags = (Array.isArray(hashtags) ? hashtags : extractHashtags(content)).map(normalizeInterest).filter(Boolean)
  const normalizedContent = String(content || "").normalize("NFKC").toLocaleLowerCase()
  const normalizedInterests = [...new Set((interests || []).map(normalizeInterest).filter(Boolean))]
  return normalizedInterests.filter((interest) =>
    tags.includes(interest) || containsWholeInterest(normalizedContent, interest)
  ).slice(0, Math.max(0, Math.min(10, maxMatches)))
}

/** Match SQL's created_at DESC, id DESC order for stable chronological lanes. */
export function compareFeedOrderDesc(a: FeedOrderKey, b: FeedOrderKey): number {
  return (Number(b.createdAt) - Number(a.createdAt)) || String(b.id).localeCompare(String(a.id))
}

/** A cursor can only move toward older rows in the canonical descending order. */
export function isStrictlyOlderFeedCursor(
  candidate: { before: number; beforeId: string },
  requested: { before: number; beforeId: string },
): boolean {
  return candidate.before < requested.before
    || (candidate.before === requested.before && candidate.beforeId < requested.beforeId)
}

export function containsAnyWholeTerm(content: string, terms: string[]): boolean {
  return (terms || []).some((term) => containsWholeInterest(content, term))
}
