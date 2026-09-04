"use client"

/**
 * Wire as: Pi.authenticate(scopes, onIncompletePaymentFound)
 * Never marks success from the client alone — always hits the server.
 */

import { IdentityService } from "@/lib/identity/identity-service"

export type IncompletePaymentDTO = {
  identifier?: string
  paymentId?: string
  transaction?: { txid?: string } | null
  amount?: number | string
  metadata?: Record<string, unknown>
}

export type IncompleteRecoveryResult = {
  ok: boolean
  action?: string
  error?: string
  paymentId?: string
  txid?: string | null
  needsFulfillment?: boolean
}

export async function recoverIncompletePayment(
  payment: IncompletePaymentDTO
): Promise<IncompleteRecoveryResult> {
  const paymentId = String(payment.identifier || payment.paymentId || "").trim()
  if (!paymentId) {
    return { ok: false, error: "paymentId missing" }
  }
  const txid =
    payment.transaction && typeof payment.transaction === "object"
      ? String(payment.transaction.txid || "").trim()
      : ""

  try {
    const res = await fetch("/api/payments/incomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(IdentityService.getAuthHeaders?.() || {}),
      },
      body: JSON.stringify({
        paymentId,
        txid: txid || undefined,
        metadata: payment.metadata,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as IncompleteRecoveryResult & {
      message?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || data.message || `HTTP ${res.status}`,
        paymentId,
        action: data.action,
      }
    }
    return {
      ok: Boolean(data.ok),
      action: data.action,
      paymentId,
      txid: data.txid ?? txid,
      needsFulfillment: data.needsFulfillment,
      error: data.error,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "network",
      paymentId,
    }
  }
}

/** Drop-in callback for Pi.authenticate(scopes, onIncompletePaymentFound) */
export function onIncompletePaymentFound(
  payment: IncompletePaymentDTO
): Promise<IncompleteRecoveryResult> {
  return recoverIncompletePayment(payment)
}
