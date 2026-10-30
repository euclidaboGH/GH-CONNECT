/**
 * Dispute decision journal + adjustment linkage (Phase 26).
 * Decision ≠ provider refund proof.
 */
import {
  callOperationalRpc,
  evidenceFingerprint,
} from "@/lib/server/marketplace/operational-rpc"

export type DisputeDecisionKind =
  | "buyer_award"
  | "seller_award"
  | "partial_award"
  | "dismissed"
  | "appeal_opened"
  | "appeal_decided"

export async function recordDisputeDecision(input: {
  orderId: string
  caseRef: string
  decision: DisputeDecisionKind
  reasonCode: string
  approvalRef: string
  actorId: string
  currency: "PI" | "GHC"
  buyerAmount?: number
  sellerNetReduction?: number
  idempotencyKey: string
}): Promise<Record<string, unknown>> {
  const fp = evidenceFingerprint({
    orderId: input.orderId,
    caseRef: input.caseRef,
    decision: input.decision,
    approvalRef: input.approvalRef,
  })
  const result = await callOperationalRpc("gh_marketplace_record_dispute_decision", {
    p_order_id: input.orderId,
    p_case_ref: input.caseRef,
    p_decision: input.decision,
    p_reason_code: input.reasonCode,
    p_approval_ref: input.approvalRef,
    p_evidence_fingerprint: fp,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: input.actorId,
    p_currency: input.currency,
    p_buyer_amount: input.buyerAmount ?? 0,
    p_seller_net_reduction: input.sellerNetReduction ?? 0,
  })
  if (!result) return { ok: false, error: "OPERATIONAL_RPC_UNAVAILABLE" }
  return result
}

export async function applyDisputeAdjustment(input: {
  orderId: string
  decisionId: number
  grossAmount: number
  sellerNetReduction: number
  idempotencyKey: string
}): Promise<Record<string, unknown>> {
  const fp = evidenceFingerprint({
    orderId: input.orderId,
    decisionId: input.decisionId,
    grossAmount: input.grossAmount,
  })
  const result = await callOperationalRpc("gh_marketplace_apply_dispute_adjustment", {
    p_order_id: input.orderId,
    p_decision_id: input.decisionId,
    p_gross_amount: input.grossAmount,
    p_seller_net_reduction: input.sellerNetReduction,
    p_idempotency_key: input.idempotencyKey,
    p_evidence_fingerprint: fp,
  })
  if (!result) return { ok: false, error: "OPERATIONAL_RPC_UNAVAILABLE" }
  return result
}
