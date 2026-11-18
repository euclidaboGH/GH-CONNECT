/** Listing and cart guards for client UX. Server validates price, stock and checkout authority. */
export function safeListingQuantity(value: unknown, available: unknown, max = 99): number {
  const requested = Number(value)
  const stock = Number(available)
  const requestedCap = Number(max)
  if (!Number.isSafeInteger(requested) || requested < 1 || !Number.isSafeInteger(stock) || stock < 1) return 0
  const cap = Number.isFinite(requestedCap) ? Math.max(1, Math.min(999, Math.floor(requestedCap))) : 99
  return Math.min(requested, stock, cap)
}
export function normalizeListingSearch(value: unknown): string { return String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) }
export function listingAvailability(stock: unknown): 'in_stock'|'low_stock'|'out_of_stock'|'unknown' { const n = Number(stock); if (!Number.isSafeInteger(n) || n < 0) return 'unknown'; return n === 0 ? 'out_of_stock' : n <= 5 ? 'low_stock' : 'in_stock' }
export function canAddListingToCart(input: { listingActive?: boolean; ownListing?: boolean; stock?: unknown; quantity?: unknown }): boolean { return input.listingActive === true && input.ownListing !== true && safeListingQuantity(input.quantity ?? 1, input.stock) > 0 }
export function sellerResponseLabel(hours: unknown): string { const n = Number(hours); if (!Number.isFinite(n) || n < 0) return 'Response time unavailable'; return n < 1 ? 'Usually replies within an hour' : n < 24 ? `Usually replies within ${Math.ceil(n)} hours` : 'Usually replies within a day or more' }
