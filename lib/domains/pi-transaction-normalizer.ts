/**
 * Canonical, read-only projection of a persisted Pi payment intent for history UI.
 * This is presentation normalization only: it never asserts provider settlement or fulfilment.
 */
export type PiTransactionProjection = {
  id: string
  status: string
  amountPi?: number
  currency: string
  purpose: string
  productId: string
  productLabel: string
  referenceId: string
  createdAt?: number
  paymentId: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

const MAX_ID_LENGTH = 180
const MAX_REFERENCE_LENGTH = 200
const MAX_PROVIDER_PAYMENT_ID_LENGTH = 200
const MAX_LABEL_LENGTH = 200
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function safeIdentifier(value: string, maxLength: number): boolean {
  return value.length > 0 && value.length <= maxLength && !CONTROL_CHARS.test(value)
}

function timestamp(value: unknown): number | undefined {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Date.parse(value)
      : Number.NaN
  // Stored numeric timestamps are epoch milliseconds in this application.
  // Reject implausibly future values instead of presenting them as valid history.
  return Number.isFinite(parsed) && parsed > 0 && parsed <= Date.now() + 5 * 60_000
    ? parsed
    : undefined
}

/** Rejects malformed rows and mixed-rail records instead of coercing them into Pi history. */
export function normalizePiTransactionIntent(value: unknown): PiTransactionProjection | null {
  const raw = asRecord(value)
  if (!raw) return null

  const id = firstString(raw.id, raw.intentId)
  const currency = firstString(raw.currency).toUpperCase()
  if (!safeIdentifier(id, MAX_ID_LENGTH) || currency !== "PI") return null

  const rawAmount = raw.amountPi ?? raw.amount
  // Durable payment intents must carry a real, positive PI amount. Do not
  // coerce booleans, blank strings, hexadecimal strings, or missing values.
  if (rawAmount === null || rawAmount === undefined) return null
  if (typeof rawAmount === "string" && !/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(rawAmount.trim())) return null
  if (typeof rawAmount !== "number" && typeof rawAmount !== "string") return null
  const parsed = Number(rawAmount)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 10_000_000_000 || Number(parsed.toFixed(8)) !== parsed) return null

  const status = firstString(raw.status)
  const purpose = firstString(raw.purpose, raw.category)
  const referenceId = firstString(raw.referenceId, raw.reference_id)
  const paymentId = firstString(raw.providerPaymentId, raw.paymentId, raw.piPaymentId)
  const productId = firstString(raw.productId, asRecord(raw.metadata)?.productId)
  const productLabel = firstString(raw.productLabel, raw.title, asRecord(raw.metadata)?.productLabel)
  if ((status && !safeIdentifier(status, 48)) || (purpose && !safeIdentifier(purpose, 80))) return null
  if (referenceId && !safeIdentifier(referenceId, MAX_REFERENCE_LENGTH)) return null
  if (paymentId && !safeIdentifier(paymentId, MAX_PROVIDER_PAYMENT_ID_LENGTH)) return null
  if (productId && !safeIdentifier(productId, MAX_REFERENCE_LENGTH)) return null
  if (productLabel && (!safeIdentifier(productLabel, MAX_LABEL_LENGTH))) return null

  return {
    id,
    status,
    amountPi: parsed,
    currency,
    purpose,
    productId,
    productLabel,
    referenceId,
    createdAt: timestamp(raw.createdAt ?? raw.created_at),
    paymentId,
  }
}

/** Stable display labels; unknown purposes remain visibly identifiable, never silently reclassified. */
export function paymentPurposeLabel(purpose: unknown): string {
  const key = firstString(purpose).toLowerCase()
  const labels: Record<string, string> = {
    membership: "Membership payment",
    marketplace: "Marketplace purchase",
    boost: "Sponsored listing",
    donation: "Donation",
    sponsored_listing: "Sponsored listing",
    digital_product: "Digital product purchase",
    premium_feature: "Premium feature",
    service: "Service payment",
    verification: "Verification",
    seller_payout: "Seller payout",
    creator_earning: "Creator earnings",
    refund: "Refund",
    reward_payout: "Reward payout",
    other: "Other payment",
  }
  return labels[key] || (key ? `Payment · ${key.replace(/[_-]+/g, " ")}` : "Payment")
}
