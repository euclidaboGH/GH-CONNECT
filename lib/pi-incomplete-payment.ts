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

function emitRecoveryEvent(result: IncompleteRecoveryResult) {
  try {
    if (typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent("ghc:payment-recovery", {
        detail: result,
      })
    )
  } catch {
    /* */
  }
}

export async function recoverIncompletePayment(
  payment: IncompletePaymentDTO
): Promise<IncompleteRecoveryResult> {
  const paymentId = String(payment.identifier || payment.paymentId || "").trim()
  if (!paymentId) {
    const fail = { ok: false, error: "paymentId missing" }
    emitRecoveryEvent(fail)
    return fail
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
      const fail = {
        ok: false,
        error: data.error || data.message || `HTTP ${res.status}`,
        paymentId,
        action: data.action,
      }
      emitRecoveryEvent(fail)
      return fail
    }
    const ok: IncompleteRecoveryResult = {
      ok: Boolean(data.ok),
      action: data.action,
      paymentId,
      txid: data.txid ?? txid,
      needsFulfillment: data.needsFulfillment,
      error: data.error,
    }
    emitRecoveryEvent(ok)
    return ok
  } catch (e) {
    const fail = {
      ok: false,
      error: e instanceof Error ? e.message : "network",
      paymentId,
    }
    emitRecoveryEvent(fail)
    return fail
  }
}

/** Drop-in callback for Pi.authenticate(scopes, onIncompletePaymentFound) */
export function onIncompletePaymentFound(
  payment: IncompletePaymentDTO
): Promise<IncompleteRecoveryResult> {
  return recoverIncompletePayment(payment)
}

/** Human message for recovery UI / toasts */
export function recoveryToastMessage(result: IncompleteRecoveryResult): {
  text: string
  type: "success" | "error" | "info"
} {
  if (result.ok) {
    return {
      text: result.needsFulfillment
        ? "Previous Pi payment recovered — finishing fulfillment…"
        : "Previous incomplete Pi payment recovered successfully.",
      type: "success",
    }
  }
  return {
    text: result.error
      ? `Could not recover a previous Pi payment: ${result.error}`
      : "A previous Pi payment needs attention. Try the payment again from Wallet.",
    type: "error",
  }
}
