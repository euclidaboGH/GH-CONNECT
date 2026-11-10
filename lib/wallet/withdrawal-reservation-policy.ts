/**
 * When Pi becomes "reserved" — only after an accepted payout request, never on quote/preview.
 */

export const RESERVE_ON_QUOTE = false
export const RESERVE_ON_FEE_PREVIEW = false
export const RESERVE_ON_CONSENT = false
export const RESERVE_ON_PIN_VERIFY_ONLY = false
/** True only after server accepts create-payout-request (authoritative). */
export const RESERVE_ON_ACCEPTED_PAYOUT_REQUEST = true

export function humanizeReservationState(state: string | null | undefined): string {
  const s = String(state || "").toLowerCase()
  if (s === "reserved" || s === "pending_execution") {
    return "Reserved for an open withdrawal request. It will return to available if the request fails or is cancelled by policy."
  }
  if (s === "available" || s === "eligible") {
    return "Available to withdraw (fees and limits still apply)."
  }
  if (s === "pending") {
    return "Pending maturity — not withdrawable yet."
  }
  return "Balance state from server; GreenHaven does not invent availability."
}
