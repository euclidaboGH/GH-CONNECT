/**
 * GHC → Pi withdrawal (server-authoritative).
 * Rate: REFERENCE_GHC_PER_PI from economic-config (100 GHC per 1 π reference).
 * Minimum: 100 π equivalent → ghcMin = 100 * ghcPerPi.
 */
import { REFERENCE_GHC_PER_PI } from "@/lib/server/economy/economic-config"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { executeDurableGhcSpend } from "@/lib/server/economy/store"

export const WITHDRAWAL_MIN_PI = 100 as const

export type WithdrawalStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed"

export type WithdrawalRequest = {
  id: string
  userId: string
  ghcAmount: number
  ghcPerPi: number
  piAmount: number
  minPiThreshold: number
  piWalletAddress: string
  status: WithdrawalStatus
  idempotencyKey: string
  rejectReason?: string | null
  settlementRef?: string | null
  operatorId?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

function mapRow(row: Record<string, unknown>): WithdrawalRequest {
  return {
    id: String(row.id || ""),
    userId: String(row.user_id || row.userId || ""),
    ghcAmount: Number(row.ghc_amount ?? row.ghcAmount ?? 0),
    ghcPerPi: Number(row.ghc_per_pi ?? row.ghcPerPi ?? REFERENCE_GHC_PER_PI),
    piAmount: Number(row.pi_amount ?? row.piAmount ?? 0),
    minPiThreshold: Number(row.min_pi_threshold ?? row.minPiThreshold ?? WITHDRAWAL_MIN_PI),
    piWalletAddress: String(row.pi_wallet_address ?? row.piWalletAddress ?? ""),
    status: String(row.status || "requested") as WithdrawalStatus,
    idempotencyKey: String(row.idempotency_key ?? row.idempotencyKey ?? ""),
    rejectReason: (row.reject_reason ?? row.rejectReason ?? null) as string | null,
    settlementRef: (row.settlement_ref ?? row.settlementRef ?? null) as string | null,
    operatorId: (row.operator_id ?? row.operatorId ?? null) as string | null,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ""),
    completedAt: (row.completed_at ?? row.completedAt ?? null) as string | null,
  }
}

/** Approved rate: GHC per 1 Pi (not Pi per GHC). */
export function getApprovedGhcPerPi(): number {
  const envRate = Number(process.env.GHC_WITHDRAWAL_GHC_PER_PI || "")
  if (Number.isFinite(envRate) && envRate > 0) return envRate
  return REFERENCE_GHC_PER_PI
}

export function piFromGhc(ghcAmount: number, ghcPerPi: number = getApprovedGhcPerPi()): number {
  const rate = ghcPerPi > 0 ? ghcPerPi : getApprovedGhcPerPi()
  return Math.round((ghcAmount / rate) * 1e8) / 1e8
}

export function minGhcForWithdrawal(ghcPerPi: number = getApprovedGhcPerPi()): number {
  return WITHDRAWAL_MIN_PI * (ghcPerPi > 0 ? ghcPerPi : getApprovedGhcPerPi())
}

type RpcJsonSuccess = { ok: true; data: unknown }
type RpcJsonFailure = { ok: false; error: string }
type RpcJsonResult = RpcJsonSuccess | RpcJsonFailure

async function rpcJson(
  fn: string,
  args: Record<string, unknown>
): Promise<RpcJsonResult> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "DB_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify(args),
        cache: "no-store",
      }
    )
    const data = (await res.json().catch(() => null)) as unknown
    if (!res.ok) {
      const errObj = data && typeof data === "object" ? (data as Record<string, unknown>) : {}
      return { ok: false, error: String(errObj.message || errObj.error || `HTTP_${res.status}`) }
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "RPC_FAILED" }
  }
}

export async function getWithdrawalQuote(ledgerBalance: number, lockedGhc: number) {
  const ghcPerPi = getApprovedGhcPerPi()
  const withdrawable = Math.max(0, ledgerBalance - lockedGhc)
  const minGhc = minGhcForWithdrawal(ghcPerPi)
  const piEquivalent = piFromGhc(withdrawable, ghcPerPi)
  return {
    ghcPerPi,
    minPi: WITHDRAWAL_MIN_PI,
    minGhc,
    ledgerBalance,
    lockedGhc,
    withdrawableGhc: withdrawable,
    piEquivalent,
    eligible: withdrawable >= minGhc,
    note: "Rate is GHC per 1 π (reference). 100 GHC ≠ 100 π.",
  }
}

export async function fetchLockedGhc(userId: string): Promise<number> {
  const result = await rpcJson("ghc_withdrawal_locked_ghc", { p_user_id: userId })
  if (!result.ok) return 0
  // RPC may return scalar
  const raw = result.data
  if (typeof raw === "number") return Math.max(0, raw)
  if (raw && typeof raw === "object" && "ghc_withdrawal_locked_ghc" in raw) {
    return Math.max(0, Number((raw as { ghc_withdrawal_locked_ghc: number }).ghc_withdrawal_locked_ghc))
  }
  // PostgREST often returns bare number as JSON number — handled above; else try value
  const n = Number(raw as unknown)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export async function createWithdrawalRequest(input: {
  userId: string
  ghcAmount: number
  piWalletAddress: string
  idempotencyKey: string
}): Promise<{ ok: boolean; request?: WithdrawalRequest; error?: string; duplicate?: boolean }> {
  const ghcPerPi = getApprovedGhcPerPi()
  const result = await rpcJson("ghc_withdrawal_create", {
    p_user_id: input.userId,
    p_ghc_amount: input.ghcAmount,
    p_ghc_per_pi: ghcPerPi,
    p_pi_wallet: input.piWalletAddress,
    p_idempotency_key: input.idempotencyKey,
    p_min_pi: WITHDRAWAL_MIN_PI,
  })
  if (!result.ok) {
    return { ok: false, error: result.error || "CREATE_FAILED" }
  }
  const data = result.data
  if (!data || typeof data !== "object") {
    return { ok: false, error: "CREATE_FAILED" }
  }
  const dataObj = data as Record<string, unknown>
  if (dataObj.ok === false) {
    return { ok: false, error: String(dataObj.error || "CREATE_FAILED") }
  }
  const req =
    dataObj.request && typeof dataObj.request === "object"
      ? (dataObj.request as Record<string, unknown>)
      : null
  if (!req) {
    return { ok: false, error: "CREATE_FAILED" }
  }
  return {
    ok: true,
    duplicate: Boolean(dataObj.duplicate),
    request: mapRow(req),
  }
}

export async function listWithdrawalsForUser(userId: string): Promise<WithdrawalRequest[]> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return []
  try {
    const url =
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_withdrawal_requests` +
      `?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    })
    if (!res.ok) return []
    const rows = (await res.json()) as Record<string, unknown>[]
    return Array.isArray(rows) ? rows.map(mapRow) : []
  } catch {
    return []
  }
}

export async function operatorSetWithdrawalStatus(input: {
  id: string
  operatorId: string
  status: WithdrawalStatus
  settlementRef?: string
  rejectReason?: string
}): Promise<{ ok: boolean; request?: WithdrawalRequest; error?: string }> {
  const result = await rpcJson("ghc_withdrawal_set_status", {
    p_id: input.id,
    p_operator_id: input.operatorId,
    p_status: input.status,
    p_settlement_ref: input.settlementRef ?? null,
    p_reject_reason: input.rejectReason ?? null,
  })
  if (!result.ok) {
    return { ok: false, error: result.error || "STATUS_FAILED" }
  }
  if (!result.data || typeof result.data !== "object") {
    return { ok: false, error: "STATUS_FAILED" }
  }
  const statusData = result.data as Record<string, unknown>
  if (statusData.ok === false) {
    return { ok: false, error: String(statusData.error || "STATUS_FAILED") }
  }
  const req = mapRow(statusData.request as Record<string, unknown>)

  // On completed: permanent ledger debit once (idempotent spend ref)
  if (input.status === "completed" && req.userId) {
    const spend = await executeDurableGhcSpend({
      userId: req.userId,
      amount: req.ghcAmount,
      referenceId: `withdrawal_settle:${req.id}`,
      reason: "GHC withdrawal settled to Pi",
      sourceEvent: "WITHDRAWAL_SETTLE",
    })
    if (!spend.ok && spend.error !== "INSUFFICIENT" /* prefer surface real errors */) {
      // Idempotent re-complete may already have spent
      if (!spend.ok) {
        return {
          ok: false,
          error: spend.error || "SETTLE_SPEND_FAILED",
          request: req,
        }
      }
    }
  }

  return { ok: true, request: req }
}
