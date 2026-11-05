/**
 * Transactionally consistent membership renewal via verified payment intent.
 * Canonical entitlement remains sole authority — no parallel membership balance.
 */
import { createHash } from "node:crypto"
import { callOperationalRpc } from "@/lib/server/marketplace/operational-rpc"

export function membershipRenewalFingerprint(paymentIntentId: string, userId: string): string {
  return createHash("sha256")
    .update(`membership-renewal:${paymentIntentId}:${userId}`)
    .digest("hex")
}

/** Duration helpers matching catalog periods */
export function durationForBillingPeriod(period: string): string {
  switch (period) {
    case "monthly":
      return "2 months"
    case "four_months":
      return "5 months"
    case "eight_months":
      return "9 months"
    case "yearly":
      return "13 months"
    default:
      return "2 months"
  }
}

export async function renewMembershipFromVerifiedIntent(input: {
  paymentIntentId: string
  userId: string
  durationInterval?: string
}): Promise<Record<string, unknown>> {
  const fp = membershipRenewalFingerprint(input.paymentIntentId, input.userId)
  const result = await callOperationalRpc("ghc_membership_renew_from_verified_intent", {
    p_payment_intent_id: input.paymentIntentId,
    p_evidence_fingerprint: fp,
    p_duration: input.durationInterval || "2 months",
  })
  if (!result) return { ok: false, error: "OPERATIONAL_RPC_UNAVAILABLE" }
  return result
}
