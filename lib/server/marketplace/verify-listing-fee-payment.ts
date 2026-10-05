/**
 * Verify a marketplace listing-fee payment against durable payment intents.
 * Client may supply a payment/intent id; ownership, amount, status, purpose, and
 * listing binding are established only from server-side intent records.
 *
 * Single-consumption across listings is best-effort via metadata/reference conventions;
 * durable exclusive claim of a payment to one listing may require a future migration.
 */
import {
  loadPaymentIntent,
  loadByProviderPaymentId,
  getPaymentIntent,
  getByProviderPaymentId,
} from "@/lib/server/payments/intent-store"
import type { PaymentIntent } from "@/lib/server/payments/intent-types"
import {
  type ListingFeeResult,
  listingFeeRequiresSettlement,
} from "@/lib/server/marketplace/listing-fee"

const FEE_PURPOSES = new Set(["marketplace", "sponsored_listing", "other"])

function amountsEqual(a: number, b: number): boolean {
  const ra = Math.round(Number(a) * 1e8) / 1e8
  const rb = Math.round(Number(b) * 1e8) / 1e8
  return Number.isFinite(ra) && Number.isFinite(rb) && ra === rb
}

function expectedReferenceId(listingId: string): string {
  return `marketplace_listing_fee_${listingId}`
}

function listingBound(intent: PaymentIntent, listingId: string): boolean {
  const lid = String(listingId || "").trim()
  if (!lid) return false
  const meta = intent.metadata || {}
  const metaListing = String(
    meta.listingId || meta.listing_id || meta.marketplaceListingId || ""
  ).trim()
  if (metaListing && metaListing === lid) return true
  const purposeKind = String(meta.kind || meta.feeKind || meta.purposeKind || "").toLowerCase()
  const ref = String(intent.referenceId || "").trim()
  if (ref === expectedReferenceId(lid)) return true
  if (ref === `listing_fee_${lid}`) return true
  // Require explicit listing binding — amount-only match is insufficient
  if (purposeKind === "listing_fee" && metaListing === lid) return true
  return false
}

async function resolveIntent(paymentRef: string): Promise<PaymentIntent | null> {
  const key = String(paymentRef || "").trim()
  if (!key) return null
  const fromId =
    (await loadPaymentIntent(key)) || getPaymentIntent(key)
  if (fromId) return fromId
  const fromProvider =
    (await loadByProviderPaymentId(key)) || getByProviderPaymentId(key)
  return fromProvider
}

export type ListingFeePaymentVerifyResult =
  | { ok: true; intentId: string; status: string }
  | { ok: false; error: string }

/**
 * When settlement is required, paymentRef must resolve to a completed intent
 * owned by sellerId, matching fee amount/currency, marketplace fee purpose, and listing binding.
 */
export async function verifyListingFeePayment(input: {
  sellerId: string
  listingId: string
  fee: ListingFeeResult
  paymentRef: string | null | undefined
}): Promise<ListingFeePaymentVerifyResult> {
  if (!listingFeeRequiresSettlement(input.fee)) {
    return { ok: true, intentId: "", status: "FEE_NOT_REQUIRED" }
  }

  const paymentRef = String(input.paymentRef || "").trim()
  if (!paymentRef) {
    return { ok: false, error: "LISTING_FEE_PAYMENT_REQUIRED" }
  }

  const intent = await resolveIntent(paymentRef)
  if (!intent) {
    return { ok: false, error: "LISTING_FEE_PAYMENT_NOT_FOUND" }
  }

  if (intent.userId !== input.sellerId) {
    return { ok: false, error: "LISTING_FEE_PAYMENT_OWNERSHIP" }
  }

  if (intent.status !== "COMPLETED" && intent.status !== "FULFILLED") {
    return { ok: false, error: "LISTING_FEE_PAYMENT_NOT_COMPLETE" }
  }

  if (!FEE_PURPOSES.has(String(intent.purpose || ""))) {
    return { ok: false, error: "LISTING_FEE_PAYMENT_PURPOSE" }
  }

  const expectedCurrency = input.fee.feeCurrency
  if (String(intent.currency || "").toUpperCase() !== expectedCurrency) {
    return { ok: false, error: "LISTING_FEE_PAYMENT_CURRENCY" }
  }

  if (!amountsEqual(intent.amount, input.fee.feeAmount)) {
    return { ok: false, error: "LISTING_FEE_PAYMENT_AMOUNT" }
  }

  if (!listingBound(intent, input.listingId)) {
    return { ok: false, error: "LISTING_FEE_PAYMENT_NOT_BOUND" }
  }

  // Soft single-use: if metadata already names a different listing, reject.
  const meta = intent.metadata || {}
  const consumed = String(meta.consumedByListingId || meta.consumed_by_listing_id || "").trim()
  if (consumed && consumed !== String(input.listingId).trim()) {
    return { ok: false, error: "LISTING_FEE_PAYMENT_ALREADY_USED" }
  }

  return { ok: true, intentId: intent.id, status: intent.status }
}

export { expectedReferenceId as listingFeePaymentReferenceId }
