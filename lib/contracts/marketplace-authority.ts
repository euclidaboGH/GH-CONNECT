/**
 * Phase 2A — marketplace economic authority.
 * Client may display server quotes only. Never settle from client math.
 */

export type ServerListingQuote = {
  listingId: string
  sellerId: string
  unitPrice: number
  currency: "GHC" | "PI" | string
  quantityAvailable: number
  quantityRequested: number
  subtotal: number
  fees: number
  total: number
  inventoryOk: boolean
  quoteId?: string
  quotedAt?: string
}

export type ClientCheckoutDraft = {
  listingId: string
  quantity: number
  /** Display-only — ignored for settlement */
  displayedUnitPrice?: number
  displayedTotal?: number
}

/** Reject client totals that disagree with server quote beyond dust. */
export function clientTotalMatchesServer(
  clientTotal: number | undefined,
  serverTotal: number,
  epsilon = 0.000001,
): boolean {
  if (clientTotal === undefined || !Number.isFinite(clientTotal)) return true
  return Math.abs(clientTotal - serverTotal) <= epsilon
}

export function assertInventory(quantityRequested: number, quantityAvailable: number): boolean {
  return (
    Number.isFinite(quantityRequested) &&
    quantityRequested > 0 &&
    Number.isFinite(quantityAvailable) &&
    quantityRequested <= quantityAvailable
  )
}
