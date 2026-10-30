/**
 * Historical payout corrections: dry-run → approval → append-only adjustment.
 * Never rewrites historical allocation rows.
 */
import {
  callOperationalRpc,
  evidenceFingerprint,
} from "@/lib/server/marketplace/operational-rpc"

export type CorrectionType =
  | "release_reservation"
  | "settlement_evidence_correction"
  | "allocation_reversal"

export type PayoutCorrectionDryRun = {
  ok: boolean
  error?: string
  payoutRequestId: string
  orderId: string
  amount: number
  blocked?: boolean
  blockReasons?: string[]
  note: string
}

export function dryRunPayoutCorrection(input: {
  payoutRequestId: string
  orderId: string
  amount: number
  settlementVerified: boolean
}): PayoutCorrectionDryRun {
  const blockReasons: string[] = []
  if (!input.payoutRequestId.trim()) blockReasons.push("PAYOUT_REQUEST_REQUIRED")
  if (!input.orderId.trim()) blockReasons.push("ORDER_REQUIRED")
  if (!Number.isFinite(input.amount) || input.amount <= 0) blockReasons.push("POSITIVE_AMOUNT_REQUIRED")
  if (!input.settlementVerified) blockReasons.push("SETTLEMENT_NOT_EXTERNALLY_VERIFIED")
  return {
    ok: blockReasons.length === 0,
    payoutRequestId: input.payoutRequestId,
    orderId: input.orderId,
    amount: input.amount,
    blocked: blockReasons.length > 0,
    blockReasons,
    note:
      blockReasons.length > 0
        ? "Correction blocked until settlement is externally verified and inputs are valid"
        : "Dry-run ok — still requires explicit approval evidence before apply",
  }
}

export async function recordPayoutCorrectionApproval(input: {
  payoutRequestId: string
  orderId: string
  currency: "PI" | "GHC"
  correctionType: CorrectionType
  amount: number
  approvedBy: string
  approvalRef: string
  idempotencyKey: string
}): Promise<Record<string, unknown>> {
  const fp = evidenceFingerprint({
    payoutRequestId: input.payoutRequestId,
    orderId: input.orderId,
    amount: input.amount,
    approvalRef: input.approvalRef,
    correctionType: input.correctionType,
  })
  const result = await callOperationalRpc("gh_seller_payout_correction_record_approval", {
    p_payout_request_id: input.payoutRequestId,
    p_order_id: input.orderId,
    p_currency: input.currency,
    p_correction_type: input.correctionType,
    p_amount: input.amount,
    p_approved_by: input.approvedBy,
    p_approval_ref: input.approvalRef,
    p_evidence_fingerprint: fp,
    p_idempotency_key: input.idempotencyKey,
  })
  if (!result) return { ok: false, error: "OPERATIONAL_RPC_UNAVAILABLE" }
  return result
}

export async function applyPayoutCorrection(input: {
  approvalId: number
  idempotencyKey: string
}): Promise<Record<string, unknown>> {
  const fp = evidenceFingerprint({ approvalId: input.approvalId, apply: true })
  const result = await callOperationalRpc("gh_seller_payout_correction_apply", {
    p_approval_id: input.approvalId,
    p_idempotency_key: input.idempotencyKey,
    p_evidence_fingerprint: fp,
  })
  if (!result) return { ok: false, error: "OPERATIONAL_RPC_UNAVAILABLE" }
  return result
}
