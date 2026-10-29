/**
 * Phase 3 — Unified earnings ledger (server-only).
 * Authoritative PI earnings movements in atomic units (1 = 1e-7 PI).
 * Never trusts client amounts or balances.
 */
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export const PI_ATOMIC_SCALE = 10_000_000 // 1e7

export function piToAtomic(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.round(amount * PI_ATOMIC_SCALE)
}

export function atomicToPi(atomic: number | string): number {
  const n = typeof atomic === "string" ? Number(atomic) : atomic
  if (!Number.isFinite(n)) return 0
  return n / PI_ATOMIC_SCALE
}

async function rpc<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (!hasPrivilegedDatabase()) return null
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })
    const result = (await response.json().catch(() => null)) as T | null
    if (!response.ok || result === null) return null
    return result
  } catch {
    return null
  }
}

export type EarningsBalances = {
  ok: boolean
  error?: string
  pendingAtomic?: number
  availableAtomic?: number
  reservedAtomic?: number
  paidAtomic?: number
  pending?: number
  available?: number
  reserved?: number
  paid?: number
}

export async function getEarningsBalances(userId: string): Promise<EarningsBalances> {
  const result = await rpc<EarningsBalances>("gh_earnings_balances", {
    p_user_id: String(userId || "").trim(),
    p_asset: "PI",
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  return result
}

export async function postEarningsCredit(input: {
  userId: string
  amountAtomic: number
  sourceKind: "cashback" | "activity_reward" | "creator_earning" | "charity" | "adjustment" | "system"
  uniqueRef: string
  status?: "pending" | "available"
  sourceTable?: string
  sourceId?: string
  reason?: string
  metadata?: Record<string, unknown>
}): Promise<{ ok: boolean; duplicate?: boolean; entryId?: string; error?: string }> {
  const result = await rpc<{
    ok?: boolean
    duplicate?: boolean
    entryId?: string
    error?: string
  }>("gh_earnings_post_credit", {
    p_user_id: input.userId,
    p_amount_atomic: input.amountAtomic,
    p_source_kind: input.sourceKind,
    p_unique_ref: input.uniqueRef,
    p_status: input.status || "available",
    p_source_table: input.sourceTable || null,
    p_source_id: input.sourceId || null,
    p_reason: input.reason || "",
    p_metadata: input.metadata || {},
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "POST_CREDIT_FAILED") }
  return { ok: true, duplicate: result.duplicate === true, entryId: result.entryId }
}

export async function reserveEarningsForPayout(input: {
  userId: string
  amountAtomic: number
  uniqueRef: string
  payoutRequestId: string
  reason?: string
}): Promise<{ ok: boolean; duplicate?: boolean; entryId?: string; error?: string }> {
  const result = await rpc<{
    ok?: boolean
    duplicate?: boolean
    entryId?: string
    error?: string
  }>("gh_earnings_reserve", {
    p_user_id: input.userId,
    p_amount_atomic: input.amountAtomic,
    p_unique_ref: input.uniqueRef,
    p_payout_request_id: input.payoutRequestId,
    p_source_kind: "withdrawal",
    p_reason: input.reason || "payout_reservation",
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "RESERVE_FAILED") }
  return { ok: true, duplicate: result.duplicate === true, entryId: result.entryId }
}

export async function settleEarningsPayout(input: {
  userId: string
  amountAtomic: number
  uniqueRef: string
  payoutRequestId: string
  reason?: string
}): Promise<{ ok: boolean; duplicate?: boolean; entryId?: string; error?: string }> {
  const result = await rpc<{
    ok?: boolean
    duplicate?: boolean
    entryId?: string
    error?: string
  }>("gh_earnings_settle", {
    p_user_id: input.userId,
    p_amount_atomic: input.amountAtomic,
    p_unique_ref: input.uniqueRef,
    p_payout_request_id: input.payoutRequestId,
    p_reason: input.reason || "payout_settled",
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "SETTLE_FAILED") }
  return { ok: true, duplicate: result.duplicate === true, entryId: result.entryId }
}

export async function getEarningsStatement(
  userId: string,
  limit = 50,
): Promise<{ ok: boolean; balances?: EarningsBalances; entries?: unknown[]; error?: string }> {
  const result = await rpc<{
    ok?: boolean
    balances?: EarningsBalances
    entries?: unknown[]
    error?: string
  }>("gh_earnings_statement", {
    p_user_id: String(userId || "").trim(),
    p_limit: limit,
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "STATEMENT_FAILED") }
  return { ok: true, balances: result.balances, entries: result.entries || [] }
}

export type WithdrawableSnapshot = {
  ok: boolean
  error?: string
  availableAtomic?: number
  reservedAtomic?: number
  pendingAtomic?: number
  paidAtomic?: number
  withdrawableAtomic?: number
  minPayoutAtomic?: number
  maxSinglePayoutAtomic?: number
  feeAtomic?: number
  eligible?: boolean
  reasons?: string[]
  available?: number
  withdrawable?: number
  minPayout?: number
  maxSinglePayout?: number
  fee?: number
  rounding?: string
  authority?: string
}

/** Authoritative withdrawable PI balance — never trusts client amounts. */
export async function getWithdrawableBalance(userId: string): Promise<WithdrawableSnapshot> {
  const result = await rpc<WithdrawableSnapshot>("gh_earnings_withdrawable", {
    p_user_id: String(userId || "").trim(),
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  return result
}

export async function releaseEarningsReservation(input: {
  userId: string
  amountAtomic: number
  uniqueRef: string
  payoutRequestId: string
  reason?: string
}): Promise<{ ok: boolean; duplicate?: boolean; entryId?: string; error?: string }> {
  const result = await rpc<{
    ok?: boolean
    duplicate?: boolean
    entryId?: string
    error?: string
  }>("gh_earnings_release_reserve", {
    p_user_id: input.userId,
    p_amount_atomic: input.amountAtomic,
    p_unique_ref: input.uniqueRef,
    p_payout_request_id: input.payoutRequestId,
    p_reason: input.reason || "payout_reservation_released",
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "RELEASE_FAILED") }
  return { ok: true, duplicate: result.duplicate === true, entryId: result.entryId }
}

/** Floor PI decimal to integer atomic units (Phase 6 rounding rule). */
export function floorPiToAtomic(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.floor(amount * PI_ATOMIC_SCALE + 1e-12)
}

export type WithdrawalQuote = {
  ok: boolean
  error?: string
  feeBps?: number
  grossAtomic?: number
  feeAtomic?: number
  netAtomic?: number
  gross?: number
  fee?: number
  net?: number
  recipientPiAppUid?: string
  recipientUsername?: string | null
  availableAtomic?: number
  destination?: string
  message?: string
}

/** Quote gross / 3% fee / net for linked Pi wallet payout. */
export async function quoteWithdrawal(input: {
  userId: string
  grossAtomic: number
}): Promise<WithdrawalQuote> {
  const result = await rpc<WithdrawalQuote>("gh_earnings_quote_withdrawal", {
    p_user_id: String(input.userId || "").trim(),
    p_gross_atomic: input.grossAtomic,
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  return result
}

/** Compute 3% fee in atomic units (ceil) without DB — for UI preview only; authority is quoteWithdrawal. */
export function previewWithdrawalFeeAtomic(grossAtomic: number, feeBps = 300): {
  grossAtomic: number
  feeAtomic: number
  netAtomic: number
} {
  const gross = Math.floor(Number(grossAtomic) || 0)
  if (gross <= 0) return { grossAtomic: 0, feeAtomic: 0, netAtomic: 0 }
  const fee = Math.floor((gross * feeBps + 9999) / 10000)
  const safeFee = Math.min(fee, Math.max(0, gross - 1))
  return { grossAtomic: gross, feeAtomic: safeFee, netAtomic: gross - safeFee }
}
