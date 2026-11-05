/**
 * Provider-confirmed refunds + request lifecycle (Phase 25/26).
 * A request is never treated as a completed refund.
 */
import {
  callOperationalRpc,
  evidenceFingerprint,
} from "@/lib/server/marketplace/operational-rpc"

export type RefundProvider = "pi" | "ghc"

export async function beginRefundRequest(input: {
  orderId: string
  provider: RefundProvider
  providerPaymentRef: string
  grossAmount: number
  sellerNetReduction: number
  idempotencyKey: string
  actorId?: string
  metadata?: Record<string, unknown>
}): Promise<Record<string, unknown>> {
  const fp = evidenceFingerprint({
    orderId: input.orderId,
    provider: input.provider,
    providerPaymentRef: input.providerPaymentRef,
    grossAmount: input.grossAmount,
    phase: "requested",
  })
  const result = await callOperationalRpc("gh_marketplace_begin_refund_request", {
    p_order_id: input.orderId,
    p_provider: input.provider,
    p_provider_payment_ref: input.providerPaymentRef,
    p_gross_amount: input.grossAmount,
    p_seller_net_reduction: input.sellerNetReduction,
    p_evidence_fingerprint: fp,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: input.actorId || null,
    p_metadata: input.metadata || {},
  })
  if (!result) return { ok: false, error: "OPERATIONAL_RPC_UNAVAILABLE" }
  return result
}

/**
 * Records a verified provider refund outcome. Caller MUST independently verify
 * provider response or webhook before invoking.
 */
export async function recordProviderConfirmedRefund(input: {
  orderId: string
  provider: RefundProvider
  providerRefundId: string
  providerPaymentRef: string
  grossAmount: number
  sellerNetReduction: number
  providerStatus: "confirmed" | "failed"
  idempotencyKey: string
  providerRawEvidence?: Record<string, unknown>
}): Promise<Record<string, unknown>> {
  const fp = evidenceFingerprint({
    orderId: input.orderId,
    provider: input.provider,
    providerRefundId: input.providerRefundId,
    providerPaymentRef: input.providerPaymentRef,
    grossAmount: input.grossAmount,
    providerStatus: input.providerStatus,
  })
  const result = await callOperationalRpc("gh_marketplace_record_provider_refund", {
    p_order_id: input.orderId,
    p_provider: input.provider,
    p_provider_refund_id: input.providerRefundId,
    p_provider_payment_ref: input.providerPaymentRef,
    p_gross_amount: input.grossAmount,
    p_seller_net_reduction: input.sellerNetReduction,
    p_provider_status: input.providerStatus,
    p_evidence_fingerprint: fp,
    p_idempotency_key: input.idempotencyKey,
    p_metadata: {
      ...(input.providerRawEvidence || {}),
      verifiedBeforeRecord: true,
    },
  })
  if (!result) return { ok: false, error: "OPERATIONAL_RPC_UNAVAILABLE" }
  return result
}
