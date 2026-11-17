/**
 * Transactionally consistent membership renewal via a verified, catalog-bound Pi intent.
 * Duration and tier are derived from the durable intent, never the operator request body.
 */
import { createHash } from "node:crypto"
import { callOperationalRpc } from "@/lib/server/marketplace/operational-rpc"
import { loadPaymentIntent } from "@/lib/server/payments/intent-store"
import { getMembershipPiPrice, paidMonthsForMembershipPeriod } from "@/lib/membership-pricing"
import { parseMembershipProductId, durationForBillingPeriod } from "@/lib/server/membership/renewal-policy"

export function membershipRenewalFingerprint(paymentIntentId: string, userId: string): string {
  return createHash("sha256")
    .update(`membership-renewal:${paymentIntentId}:${userId}`)
    .digest("hex")
}

export async function renewMembershipFromVerifiedIntent(input: {
  paymentIntentId: string
  userId: string
}): Promise<Record<string, unknown>> {
  const paymentIntentId = String(input.paymentIntentId || "").trim()
  const userId = String(input.userId || "").trim()
  if (!paymentIntentId || !userId) return { ok: false, error: "PAYMENT_INTENT_AND_USER_REQUIRED" }

  const intent = await loadPaymentIntent(paymentIntentId)
  if (!intent) return { ok: false, error: "PAYMENT_INTENT_NOT_FOUND_OR_UNAVAILABLE" }
  if (intent.userId !== userId) return { ok: false, error: "PAYMENT_INTENT_OWNER_MISMATCH" }
  if (intent.status !== "COMPLETED" && intent.status !== "FULFILLED") {
    return { ok: false, error: "VERIFIED_COMPLETED_PAYMENT_REQUIRED" }
  }
  if (intent.provider !== "pi" || intent.currency !== "PI" || !String(intent.providerPaymentId || "").trim()) {
    return { ok: false, error: "VERIFIED_PI_PROVIDER_PAYMENT_BINDING_REQUIRED" }
  }

  const product = parseMembershipProductId(intent.metadata?.productId)
  if (!product || intent.purpose !== "membership") {
    return { ok: false, error: "CANONICAL_MEMBERSHIP_PRODUCT_REQUIRED" }
  }
  const paidMonths = paidMonthsForMembershipPeriod(product.billingPeriod)
  if (!paidMonths) return { ok: false, error: "UNSUPPORTED_MEMBERSHIP_DURATION" }
  const expectedPi = getMembershipPiPrice(product.tier, paidMonths).chargePi
  if (!Number.isFinite(intent.amount) || Math.abs(intent.amount - expectedPi) > 0.001) {
    return { ok: false, error: "MEMBERSHIP_CATALOG_AMOUNT_MISMATCH" }
  }

  const fp = membershipRenewalFingerprint(paymentIntentId, userId)
  // Legacy RPC signature retains p_duration for compatibility. The reviewed
  // database function independently derives its actual duration from productId.
  const result = await callOperationalRpc("ghc_membership_renew_from_verified_intent", {
    p_payment_intent_id: paymentIntentId,
    p_evidence_fingerprint: fp,
    p_duration: durationForBillingPeriod(product.billingPeriod),
  })
  if (!result) return { ok: false, error: "OPERATIONAL_RPC_UNAVAILABLE" }
  return result
}
