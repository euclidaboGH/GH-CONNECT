/**
 * Phase 2 — search relevance (client-side refinement of an already-fetched,
 * already-filtered page). Never widens the result set and never compares
 * prices across currencies.
 */
export interface RankableListing {
  id: string
  title?: string
  description?: string
  category?: string
  tags?: string[]
  createdAt?: number
}

export function tokenizeQuery(query: string, maxTokens = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of String(query ?? "").normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
    if (out.length >= maxTokens) break
  }
  return out
}

export function relevanceScore(listing: RankableListing, query: string): number {
  const tokens = tokenizeQuery(query)
  if (!tokens.length) return 0
  const title = String(listing.title ?? "").normalize("NFKC").toLowerCase()
  const titleWords = new Set(title.split(/[^\p{L}\p{N}]+/u).filter(Boolean))
  const category = String(listing.category ?? "").toLowerCase()
  const tags = (listing.tags ?? []).map((t) => String(t).toLowerCase())
  const description = String(listing.description ?? "").normalize("NFKC").toLowerCase()
  let score = 0
  const phrase = tokens.join(" ")
  if (tokens.length > 1 && title.includes(phrase)) score += 12
  for (const token of tokens) {
    if (titleWords.has(token)) score += 8
    else if (title.includes(token)) score += 4
    if (tags.includes(token)) score += 5
    if (category === token) score += 4
    else if (category.includes(token)) score += 2
    if (description.includes(token)) score += 1
  }
  return score
}

/** Stable: ties keep newest first, then id, so ordering is deterministic. */
export function rankByRelevance<T extends RankableListing>(items: readonly T[], query: string): T[] {
  if (!tokenizeQuery(query).length) return [...items]
  return items
    .map((item) => ({ item, score: relevanceScore(item, query) }))
    .sort((a, b) => b.score - a.score || (b.item.createdAt ?? 0) - (a.item.createdAt ?? 0) || a.item.id.localeCompare(b.item.id))
    .map((entry) => entry.item)
}
