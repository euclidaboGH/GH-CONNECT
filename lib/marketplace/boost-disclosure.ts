/**
 * Phase 2 — transparent paid placement.
 * A listing is "Promoted" only while a recorded promotion window is active.
 * Promoted placement is capped so paid listings cannot crowd out organic ones.
 */
export interface PromotableListing {
  id: string
  promotedUntil?: number
  promotionKind?: string
}

export const DEFAULT_MAX_PROMOTED_SHARE = 0.25
export const DEFAULT_MIN_GAP = 3

function toMillis(ts: number): number {
  return ts < 100_000_000_000 ? ts * 1000 : ts
}

export function isPromotedNow(listing: PromotableListing, now: number = Date.now()): boolean {
  const until = Number(listing.promotedUntil)
  return Number.isFinite(until) && until > 0 && toMillis(until) > now
}

export function promotionLabel(listing: PromotableListing, now: number = Date.now()): string | null {
  if (!isPromotedNow(listing, now)) return null
  return listing.promotionKind === "featured" ? "Featured · Promoted" : "Promoted"
}

/**
 * Re-orders a page so promoted listings are at most `maxShare` of the page and
 * never closer than `minGap` positions apart. Organic order is preserved, no
 * listing is removed, and surplus promoted listings fall back to their
 * original relative position among organic ones.
 */
export function limitPromotedShare<T extends PromotableListing>(
  items: readonly T[],
  options: { now?: number; maxShare?: number; minGap?: number } = {},
): T[] {
  const now = options.now ?? Date.now()
  const maxShare = Math.min(1, Math.max(0, Number.isFinite(options.maxShare) ? Number(options.maxShare) : DEFAULT_MAX_PROMOTED_SHARE))
  const minGap = Math.max(1, Math.floor(Number.isFinite(options.minGap) ? Number(options.minGap) : DEFAULT_MIN_GAP))
  const promoted = items.filter((item) => isPromotedNow(item, now))
  if (!promoted.length) return [...items]
  const organic = items.filter((item) => !isPromotedNow(item, now))
  const cap = Math.floor(items.length * maxShare)
  const placeNow = promoted.slice(0, cap)
  const overflow = promoted.slice(cap)
  const result: T[] = []
  let p = 0
  let sinceLast = 0 // the first promoted slot opens only after minGap organic items
  for (const item of organic) {
    if (p < placeNow.length && sinceLast >= minGap) {
      result.push(placeNow[p++])
      sinceLast = 0
    }
    result.push(item)
    sinceLast += 1
  }
  while (p < placeNow.length) result.push(placeNow[p++])
  // Overflow promoted listings keep their original relative order at the end.
  return [...result, ...overflow]
}
