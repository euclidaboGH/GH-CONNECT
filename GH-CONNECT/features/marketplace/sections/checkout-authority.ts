import {
  assertInventory,
  clientTotalMatchesServer,
  type ClientCheckoutDraft,
  type ServerListingQuote,
} from "@/lib/contracts/marketplace-authority"

export function canSubmitCheckout(draft: ClientCheckoutDraft, quote: ServerListingQuote | null): {
  ok: boolean
  reason?: string
} {
  if (!quote) return { ok: false, reason: "QUOTE_REQUIRED" }
  if (quote.listingId !== draft.listingId) return { ok: false, reason: "LISTING_MISMATCH" }
  if (!assertInventory(draft.quantity, quote.quantityAvailable)) {
    return { ok: false, reason: "INVENTORY" }
  }
  if (!clientTotalMatchesServer(draft.displayedTotal, quote.total)) {
    return { ok: false, reason: "CLIENT_TOTAL_REJECTED" }
  }
  return { ok: true }
}
