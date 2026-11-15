/**
 * Phase 3 — Unified earnings ledger (server-only).
 * Authoritative PI earnings movements in atomic units (1 = 1e-7 PI).
 * Never trusts client amounts or balances.
 */
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export {
  PI_ATOMIC_SCALE,
  isValidPiAtomic,
  piToAtomic,
  atomicToPi,
  floorPiToAtomic,
  previewWithdrawalFeeAtomic,
} from "@/lib/wallet/pi-atomic"
import { isValidPiAtomic } from "@/lib/wallet/pi-atomic"

function validLedgerIdentity(userId: unknown, uniqueRef: unknown): boolean {
  return typeof userId === "string" && userId.trim().length > 0 && userId.trim().length <= 128
    && typeof uniqueRef === "string" && uniqueRef.trim().length > 0 && uniqueRef.trim().length <= 128
}

type RpcFailure = { ok: false; status: number; code: string; message: string }

/** PostgREST call that preserves why it failed (never includes keys or request bodies). */
async function rpcDetailed<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | RpcFailure> {
  if (!hasPrivilegedDatabase()) return { ok: false, status: 0, code: "DB_NOT_CONFIGURED", message: "Privileged database is not configured" }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, status: 0, code: "DB_NOT_CONFIGURED", message: "Supabase URL or service key missing" }
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
    const parsed = (await response.json().catch(() => null)) as (T & { code?: string; message?: string }) | null
    if (!response.ok || parsed === null) {
      return {
        ok: false,
        status: response.status,
        code: String(parsed?.code || `HTTP_${response.status}`).slice(0, 40),
        message: String(parsed?.message || "").slice(0, 300),
      }
    }
    return { ok: true, data: parsed }
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    return { ok: false, status: 0, code: timeout ? "RPC_TIMEOUT" : "RPC_NETWORK_ERROR", message: "" }
  }
}

async function rpc<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const r = await rpcDetailed<T>(name, body)
  return r.ok ? r.data : null
}

/** Direct registration-bonus status lookup; does not depend on a paginated statement. */
export async function getRegistrationBonusPolicyStatus(userId: string): Promise<{
  ok: boolean
  error?: string
  legacyClaimed?: boolean
  claimed?: boolean
  claimable?: boolean
  amountAtomic?: number
  amountPi?: number
  uniqueRef?: string
  message?: string
}> {
  const result = await rpc<{
    ok?: boolean; error?: string; legacyClaimed?: boolean; claimed?: boolean
    claimable?: boolean; amountAtomic?: number; amountPi?: number
    uniqueRef?: string; message?: string
  }>('gh_earnings_registration_bonus_status', { p_user_id: String(userId || '').trim() })
  if (!result) return { ok: false, error: 'EARNINGS_LEDGER_UNAVAILABLE' }
  if (result.ok !== true) return { ok: false, error: String(result.error || 'REGISTRATION_BONUS_STATUS_FAILED') }
  return { ...result, ok: true }
}

/** Atomic, serialized, idempotent registration-bonus claim/reconciliation. */
export async function claimRegistrationBonusPolicy(userId: string): Promise<{
  ok: boolean
  error?: string
  duplicate?: boolean
  entryId?: string
  legacyClaimed?: boolean
  claimed?: boolean
  claimable?: boolean
  amountAtomic?: number
  amountPi?: number
  uniqueRef?: string
  message?: string
}> {
  const result = await rpc<{
    ok?: boolean; error?: string; duplicate?: boolean; entryId?: string
    legacyClaimed?: boolean; claimed?: boolean; claimable?: boolean
    amountAtomic?: number; amountPi?: number; uniqueRef?: string; message?: string
  }>('gh_earnings_registration_bonus_claim', { p_user_id: String(userId || '').trim() })
  if (!result) return { ok: false, error: 'EARNINGS_LEDGER_UNAVAILABLE' }
  if (result.ok !== true) return { ok: false, error: String(result.error || 'REGISTRATION_BONUS_CLAIM_FAILED') }
  return { ...result, ok: true }
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
  if (!validLedgerIdentity(input.userId, input.uniqueRef) || !isValidPiAtomic(input.amountAtomic)) {
    return { ok: false, error: "INVALID_LEDGER_INPUT" }
  }
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
  if (!validLedgerIdentity(input.userId, input.uniqueRef) || !isValidPiAtomic(input.amountAtomic) || !input.payoutRequestId?.trim()) {
    return { ok: false, error: "INVALID_LEDGER_INPUT" }
  }
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
  if (!validLedgerIdentity(input.userId, input.uniqueRef) || !isValidPiAtomic(input.amountAtomic) || !input.payoutRequestId?.trim()) {
    return { ok: false, error: "INVALID_LEDGER_INPUT" }
  }
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
  if (!validLedgerIdentity(input.userId, input.uniqueRef) || !isValidPiAtomic(input.amountAtomic) || !input.payoutRequestId?.trim()) {
    return { ok: false, error: "INVALID_LEDGER_INPUT" }
  }
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
  minPayoutAtomic?: number
  maxSinglePayoutAtomic?: number
  destination?: string
  message?: string
}

/** Quote gross / 3% fee / net for linked Pi wallet payout. */
export async function quoteWithdrawal(input: {
  userId: string
  grossAtomic: number
}): Promise<WithdrawalQuote> {
  if (!input.userId?.trim() || !isValidPiAtomic(input.grossAtomic)) return { ok: false, error: "INVALID_LEDGER_INPUT" }
  const result = await rpc<WithdrawalQuote>("gh_earnings_quote_withdrawal", {
    p_user_id: String(input.userId || "").trim(),
    p_gross_atomic: input.grossAtomic,
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  return result
}


export type PiEarningsPayoutRequestResult = {
  ok: boolean
  error?: string
  duplicate?: boolean
  requestId?: string
  status?: string
  grossAtomic?: number
  feeAtomic?: number
  netAtomic?: number
  recipientPiAppUid?: string
  network?: string
}

/** Creates a durable payout request and gross reservation; does not execute a Pi transfer. */
export async function createPiEarningsPayoutRequest(input: {
  userId: string
  idempotencyKey: string
  requestFingerprint: string
  grossAtomic: number
  feeAtomic: number
  netAtomic: number
  network: "Pi Testnet"
}): Promise<PiEarningsPayoutRequestResult> {
  const validAmounts = isValidPiAtomic(input.grossAtomic) && isValidPiAtomic(input.feeAtomic, true)
    && isValidPiAtomic(input.netAtomic) && input.feeAtomic < input.grossAtomic
    && input.grossAtomic === input.feeAtomic + input.netAtomic
  if (!input.userId?.trim() || !input.idempotencyKey?.trim() || !input.requestFingerprint?.trim()
    || !validAmounts || input.network !== "Pi Testnet") {
    return { ok: false, error: "INVALID_PAYOUT_REQUEST" }
  }
  const result = await rpc<PiEarningsPayoutRequestResult>("gh_pi_earnings_payout_create", {
    p_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_request_fingerprint: input.requestFingerprint,
    p_gross_atomic: input.grossAtomic,
    p_fee_atomic: input.feeAtomic,
    p_net_atomic: input.netAtomic,
    p_network: input.network,
  })
  if (!result) return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  return result
}

/** Releases the user's payout reservations that never reached the provider back to Available. */
export type PiPayoutReservationExplanation = {
  requestId: string
  status: "reserved" | "processing" | "uncertain" | "released"
  grossAtomic: number | string
  reasonCode: string
  reason: string
  unlockCondition: string
}

export async function cancelUnstartedPayoutRequests(userId: string): Promise<{
  ok: boolean
  error?: string
  released?: number
  releasedAtomic?: number
  items?: PiPayoutReservationExplanation[]
  message?: string
}> {
  const call = await rpcDetailed<{
    ok?: boolean
    error?: string
    released?: number
    releasedAtomic?: number
    items?: PiPayoutReservationExplanation[]
    message?: string
  }>("gh_pi_earnings_payout_cancel_unstarted", { p_user_id: String(userId || "").trim() })
  if (!call.ok) {
    // Log the real cause server-side (no secrets) so operators can diagnose; return a precise, safe code.
    console.error("[pi-earnings-cancel] rpc failed", { status: call.status, code: call.code, message: call.message })
    const missing = call.status === 404 || call.code === "PGRST202" || call.code === "42883"
    if (missing) return { ok: false, error: "PAYOUT_RECOVERY_MIGRATION_PENDING" }
    if (call.message.startsWith("Release failed for")) return { ok: false, error: "RESERVATION_RELEASE_REJECTED" }
    return { ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE" }
  }
  const result = call.data
  if (result.ok !== true) return { ok: false, error: String(result.error || "CANCEL_FAILED") }
  return {
    ok: true,
    released: Number(result.released || 0),
    releasedAtomic: Number(result.releasedAtomic || 0),
    items: Array.isArray(result.items) ? result.items : [],
    message: typeof result.message === "string" ? result.message : undefined,
  }
}
