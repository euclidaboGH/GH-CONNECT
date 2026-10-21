/**
 * Server-side settlement for pilot fees (community create, listing activation).
 * GHC: durable ghc_execute_spend (or memory spend).
 * Pi: completed payment intent owned by payer, amount/currency match, reference bound.
 * Never trusts client fee amounts.
 */

import {
  allowMemoryServer,
  isDatabaseConfigured,
} from "@/lib/server/economy/http"
import {
  executeAuthoritativeSpend,
  executeDurableGhcSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { loadPaymentIntent } from "@/lib/server/payments/intent-store"
import type { FeeCurrency, PilotFeeQuote } from "@/lib/server/fees/pilot-fee-policy"

export type SettlePilotFeeInput = {
  userId: string
  fee: PilotFeeQuote
  referenceId: string
  reason: string
  sourceEvent: string
  paymentRef?: string | null
  bindKey?: string
  bindValue?: string
}

export type SettlePilotFeeResult =
  | { ok: true; method: "ghc" | "pi"; txId?: string; intentId?: string; idempotent?: boolean }
  | { ok: false; error: string }

async function settleGhc(input: SettlePilotFeeInput): Promise<SettlePilotFeeResult> {
  const amount = Number(input.fee.feeAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: true, method: "ghc", idempotent: true }
  }

  if (isDatabaseConfigured()) {
    const spend = await executeDurableGhcSpend({
      userId: input.userId,
      amount,
      referenceId: input.referenceId,
      reason: input.reason,
      sourceEvent: input.sourceEvent,
    })
    if (!spend.ok) {
      return { ok: false, error: spend.error || "SPEND_FAILED" }
    }
    const tx = spend.tx
    return {
      ok: true,
      method: "ghc",
      txId: tx && typeof tx === "object" && "id" in tx ? String((tx as { id: string }).id) : undefined,
      idempotent: Boolean(spend.idempotent),
    }
  }

  if (allowMemoryServer()) {
    const spend = await executeAuthoritativeSpend(getProcessGhcStore(), {
      userId: input.userId,
      amount,
      referenceId: input.referenceId,
      reason: input.reason,
      sourceEvent: input.sourceEvent,
    })
    if (!spend.ok) {
      return { ok: false, error: spend.error || "SPEND_FAILED" }
    }
    return {
      ok: true,
      method: "ghc",
      txId: spend.tx.id,
      idempotent: Boolean(spend.idempotent),
    }
  }

  return { ok: false, error: "SERVER_UNAVAILABLE" }
}

async function settlePi(input: SettlePilotFeeInput): Promise<SettlePilotFeeResult> {
  const ref = String(input.paymentRef || "").trim()
  if (!ref) {
    return { ok: false, error: "FEE_PAYMENT_REQUIRED" }
  }

  const intent = await loadPaymentIntent(ref)
  if (!intent) {
    return { ok: false, error: "FEE_PAYMENT_NOT_FOUND" }
  }
  if (intent.userId !== input.userId) {
    return { ok: false, error: "FEE_PAYMENT_NOT_OWNED" }
  }
  if (String(intent.status || "").toUpperCase() !== "COMPLETED") {
    return { ok: false, error: "FEE_PAYMENT_NOT_COMPLETED" }
  }

  const expected = Number(input.fee.feeAmount)
  if (!Number.isFinite(Number(intent.amount)) || Math.abs(Number(intent.amount) - expected) > 1e-8) {
    return { ok: false, error: "FEE_AMOUNT_MISMATCH" }
  }

  const cur = String(intent.currency || intent.metadata?.currency || "PI").toUpperCase()
  if (cur !== "PI" && cur !== "π") {
    return { ok: false, error: "FEE_CURRENCY_MISMATCH" }
  }

  const refId = String(intent.referenceId || intent.metadata?.referenceId || "")
  const metaBind =
    input.bindKey && intent.metadata
      ? String((intent.metadata as Record<string, unknown>)[input.bindKey] || "")
      : ""
  if (input.referenceId && refId && refId !== input.referenceId) {
    if (metaBind !== (input.bindValue || "")) {
      return { ok: false, error: "FEE_REFERENCE_MISMATCH" }
    }
  }

  return { ok: true, method: "pi", intentId: intent.id }
}

export async function settlePilotFee(input: SettlePilotFeeInput): Promise<SettlePilotFeeResult> {
  const currency = (input.fee.feeCurrency || "GHC").toUpperCase() as FeeCurrency
  if (currency === "PI") {
    return settlePi(input)
  }
  return settleGhc(input)
}

export async function settlePilotFeeGhcOnly(input: SettlePilotFeeInput): Promise<SettlePilotFeeResult> {
  return settleGhc(input)
}
