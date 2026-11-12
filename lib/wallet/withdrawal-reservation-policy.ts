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
    return "Reserved for an open withdrawal request. Return reserved π is available only when provider execution never started. If a request may have reached Pi, its reservation stays protected until the provider outcome is reconciled."
  }
  if (s === "available" || s === "eligible") {
    return "Available to withdraw (fees and limits still apply)."
  }
  if (s === "pending") {
    return "Pending maturity — not withdrawable yet."
  }
  return "Balance state from server; GreenHaven does not invent availability."
}

/** Incomplete reservations with no Pi payment evidence may be returned by the account holder. */
export const SELF_SERVICE_RELEASE_INCOMPLETE_WITHOUT_PROVIDER_EVIDENCE = true
/** Rows with provider_payment_id / provider_txid never self-release without reconcile. */
export const FORCE_RELEASE_WITH_PROVIDER_EVIDENCE = false
