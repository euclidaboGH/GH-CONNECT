/**
 * Phase 10 — A2U receipt verification contract.
 * A payout is only receipt-complete when provider evidence, binding, and durable paid state align.
 * Never invents txids or marks paid from client claims alone.
 */
import type { PiBackendPayment } from "pi-backend"
import {
  canMarkA2uPaid,
  providerPaymentMatchesA2u,
  type A2uBinding,
} from "@/lib/server/payments/a2u-orchestration"

export type A2uReceiptInput = {
  requestId: string
  recipientUid: string
  amount: number
  providerPaymentId: string
  txid: string
  payment: PiBackendPayment
  /** Durable domain status after settle RPC (must already be paid) */
  durableStatus: string
  network?: string
}

export type A2uReceiptResult =
  | {
      ok: true
      receipt: {
        requestId: string
        providerPaymentId: string
        txid: string
        recipientUid: string
        amount: number
        network: string
        verified: true
        durableStatus: string
      }
    }
  | { ok: false; error: string }

export function verifyA2uReceipt(input: A2uReceiptInput): A2uReceiptResult {
  if (!input.requestId || !input.providerPaymentId || !input.txid) {
    return { ok: false, error: "RECEIPT_FIELDS_REQUIRED" }
  }
  if (input.durableStatus !== "paid") {
    return { ok: false, error: "DURABLE_STATUS_NOT_PAID" }
  }
  const binding: A2uBinding = {
    paymentId: input.providerPaymentId,
    requestId: input.requestId,
    recipientUid: input.recipientUid,
    amount: input.amount,
    txid: input.txid,
    requirePayoutRequestId: true,
  }
  if (!providerPaymentMatchesA2u(input.payment, binding)) {
    return { ok: false, error: "PROVIDER_BINDING_MISMATCH" }
  }
  const gate = canMarkA2uPaid({ payment: input.payment, binding })
  if (!gate.ok) {
    return { ok: false, error: gate.error }
  }
  if (input.payment.identifier !== input.providerPaymentId) {
    return { ok: false, error: "PAYMENT_ID_MISMATCH" }
  }
  if (input.payment.transaction?.txid !== input.txid) {
    return { ok: false, error: "TXID_MISMATCH" }
  }
  const network = input.network || input.payment.network || "Pi Testnet"
  if (network !== "Pi Testnet") {
    return { ok: false, error: "NETWORK_NOT_TESTNET" }
  }
  return {
    ok: true,
    receipt: {
      requestId: input.requestId,
      providerPaymentId: input.providerPaymentId,
      txid: input.txid,
      recipientUid: input.recipientUid,
      amount: input.amount,
      network,
      verified: true,
      durableStatus: input.durableStatus,
    },
  }
}

/** Public-safe receipt projection for API responses (no secrets). */
export function publicReceiptView(receipt: {
  requestId: string
  providerPaymentId: string
  txid: string
  amount: number
  network: string
}) {
  return {
    requestId: receipt.requestId,
    providerPaymentId: receipt.providerPaymentId,
    txid: receipt.txid,
    amount: receipt.amount,
    network: receipt.network,
    verified: true as const,
  }
}
