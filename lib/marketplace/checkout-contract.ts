/**
 * Marketplace checkout contracts shared by buyer surfaces.
 * A cart/listing cache is presentation-only; payment routing must use the
 * currency returned by the server-created durable order.
 */
export type MarketplaceCurrency = "GHC" | "PI"

export function getMarketplaceOrderCurrency(order: unknown): MarketplaceCurrency | null {
  if (!order || typeof order !== "object" || Array.isArray(order)) return null
  const row = order as Record<string, unknown>
  const raw = typeof row.currency === "string" ? row.currency : ""
  const currency = raw.trim().toUpperCase()
  return currency === "GHC" || currency === "PI" ? currency : null
}

/** Strict seller stock parsing. Missing edit input preserves the existing count. */
export function parseMarketplaceAvailability(value: unknown, fallback = 1): number | null {
  if (value === undefined) return Number.isSafeInteger(fallback) && fallback >= 0 && fallback <= 9999 ? fallback : null
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 9999) return null
  return value
}
