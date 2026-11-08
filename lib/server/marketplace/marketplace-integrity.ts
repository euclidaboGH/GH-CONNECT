/**
 * Phase 7 — Marketplace integrity helpers (buyer / seller / orders).
 * Financial totals always come from durable listing reservation RPCs — never the client.
 */

export function humanizeMarketplaceOrderError(code: string, available?: number): string {
  switch (String(code || "").toUpperCase()) {
    case "CANNOT_BUY_OWN":
      return "You cannot buy your own listing."
    case "INSUFFICIENT_STOCK":
      return available != null && Number.isFinite(available)
        ? `Only ${Math.max(0, Math.floor(available))} left in stock.`
        : "Not enough stock for this quantity."
    case "LISTING_NOT_FOUND":
      return "This listing is no longer available."
    case "LISTING_UNAVAILABLE":
      return "This listing is not available for purchase."
    case "VARIANT_SELECTION_REQUIRED":
      return "Choose a product option before checkout."
    case "VARIANT_UNAVAILABLE":
      return "That product option is no longer available."
    case "IDEMPOTENCY_CONFLICT":
      return "A different order is already using this checkout key. Retry with a fresh attempt."
    case "IDEMPOTENCY_KEY_REQUIRED":
      return "Checkout needs a stable attempt key. Refresh and try again."
    case "DURABLE_RESERVATION_REQUIRED":
    case "RESERVATION_RPC_UNAVAILABLE":
      return "Orders are temporarily unavailable. Please try again shortly."
    case "UNSUPPORTED_CURRENCY":
      return "This listing currency is not supported for checkout."
    case "INVALID_QUANTITY":
      return "Quantity must be a whole number between 1 and 99."
    case "INVALID_INPUT":
      return "Checkout details were invalid. Refresh the listing and try again."
    default:
      return "Could not create this order. Please try again."
  }
}

export function isOwnListingSeller(viewerId: string, sellerId: string | null | undefined): boolean {
  const a = String(viewerId || "").trim()
  const b = String(sellerId || "").trim()
  return Boolean(a && b && a === b)
}

export const MARKETPLACE_PHASE = "7-marketplace-commerce" as const
