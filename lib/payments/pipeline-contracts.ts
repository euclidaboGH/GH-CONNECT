/**
 * Shared payment pipeline contracts — timeouts, credentials, commission.
 */

export const PAYMENT_MUTATION_TIMEOUT_MS = 45_000
export const PAYMENT_READ_TIMEOUT_MS = 12_000
export const PAYMENT_CREDENTIALS: RequestCredentials = "include"
export const PAYMENT_CACHE: RequestCache = "no-store"
export const MARKETPLACE_COMMISSION_BPS = 500

export function paymentHeaders(extra?: HeadersInit): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  }
}

export function humanizePaymentError(code?: string): string {
  switch (code) {
    case "INSUFFICIENT_FUNDS":
      return "Insufficient balance for this payment."
    case "IDEMPOTENT_REPLAY":
      return "This payment was already processed."
    case "PROVIDER_PENDING":
      return "Payment is still processing with the provider."
    case "UNAUTHORIZED":
      return "Sign in to continue this payment."
    case "RATE_LIMIT":
      return "Too many payment attempts. Please wait."
    default:
      return "Payment could not be completed. Try again or contact support."
  }
}
