/**
 * Server-only GHC database access.
 * Privileged credentials never leave this module to the client.
 */

import { readGhcServerEnv, hasPrivilegedDatabase, type GhcServerEnv } from "./env"
import type { GhcTransferResult } from "@/lib/domains/economy-transfer-contract"
import { mapTransferFailure } from "@/lib/domains/economy-transfer-contract"
import type { GhcTransaction } from "@/lib/domains/economy-types"

export type RpcTransferInput = {
  senderId: string
  toUserId: string
  amount: number
  referenceId: string
  note?: string
  requestId?: string
}

function mapRpcJson(data: unknown): GhcTransferResult {
  const row = data as Record<string, unknown>
  if (!row || typeof row !== "object") {
    return { ok: false, error: mapTransferFailure("Empty RPC response") }
  }
  if (row.ok === false) {
    return {
      ok: false,
      error: mapTransferFailure(String(row.message || row.code || "TRANSFER_FAILED"), String(row.code || "TRANSFER_FAILED") as any),
    }
  }
  const debitTx = (row.debitTx || row.debit) as GhcTransaction | undefined
  const creditTx = (row.creditTx || row.credit) as GhcTransaction | undefined
  if (!debitTx || !creditTx) {
    return { ok: false, error: mapTransferFailure("Invalid RPC transfer payload") }
  }
  // Normalize numeric amounts if returned as strings from Postgres
  const norm = (tx: GhcTransaction): GhcTransaction => ({
    ...tx,
    amount: Number(tx.amount),
    createdAt: Number(tx.createdAt) || Date.now(),
    userId: String(tx.userId),
    kind: tx.kind,
    status: tx.status,
    reason: tx.reason || "",
    sourceEvent: tx.sourceEvent || "WALLET_TRANSFER",
    referenceId: tx.referenceId || String(row.referenceId || ""),
  })
  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    referenceId: String(row.referenceId || debitTx.referenceId),
    debitTx: norm(debitTx),
    creditTx: norm(creditTx),
  }
}

/**
 * Call public.ghc_execute_transfer via Supabase REST RPC (service role).
 * This is the production path when SUPABASE_URL + SERVICE_ROLE_KEY are set.
 */
export async function rpcExecuteTransfer(
  input: RpcTransferInput,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<GhcTransferResult> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: mapTransferFailure("SERVER_UNAVAILABLE", "SERVER_UNAVAILABLE") }
  }
  // Defend every caller of this privileged RPC, not only the HTTP route.
  if (!input.senderId?.trim() || !input.toUserId?.trim() || input.senderId === input.toUserId ||
      !Number.isFinite(input.amount) || input.amount <= 0 ||
      !input.referenceId?.trim() || input.referenceId.length > 160 || /[\r\n\u0000-\u001f\u007f]/.test(input.referenceId) ||
      (input.note != null && (typeof input.note !== "string" || input.note.length > 500)) ||
      (input.requestId != null && (typeof input.requestId !== "string" || input.requestId.length > 160 || /[\r\n\u0000-\u001f\u007f]/.test(input.requestId)))) {
    return { ok: false, error: mapTransferFailure("INVALID_TRANSFER_INPUT", "TRANSFER_FAILED") }
  }

  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_execute_transfer`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        p_sender_id: input.senderId,
        p_to_user_id: input.toUserId,
        p_amount: input.amount,
        p_reference_id: input.referenceId,
        p_note: input.note ?? null,
        p_request_id: input.requestId ?? null,
      }),
      signal: AbortSignal.timeout(12_000),
    })

    if (!res.ok) {
      // HTTP error bodies may contain SQL, schema, or provider internals; never
      // surface them through the domain error mapper. Domain errors are JSONB.
      return {
        ok: false,
        error: mapTransferFailure(res.status >= 500 ? "SERVER_UNAVAILABLE" : "TRANSFER_FAILED", res.status >= 500 ? "SERVER_UNAVAILABLE" : "TRANSFER_FAILED"),
      }
    }

    const data = await res.json()
    // Supabase may return the jsonb value directly or nested
    const payload = Array.isArray(data) ? data[0] : data
    return mapRpcJson(payload)
  } catch (e) {
    // A timeout can happen after the database committed. Preserve the same
    // referenceId on retries and reconcile before issuing a fresh transfer.
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
    return {
      ok: false,
      error: mapTransferFailure(timedOut ? "NETWORK_TIMEOUT" : "SERVER_UNAVAILABLE", timedOut ? "NETWORK_TIMEOUT" : "SERVER_UNAVAILABLE"),
    }
  }
}

export async function rpcListTransactions(
  userId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<GhcTransaction[] | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const url =
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_transactions` +
    `?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=500`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<Record<string, unknown>>
    if (!Array.isArray(rows) || rows.length > 500 || rows.some((r) => !r || typeof r !== "object" ||
        !Number.isFinite(Number(r.amount)) || !Number.isFinite(new Date(String(r.created_at)).getTime()) ||
        !String(r.id || "").trim() || String(r.user_id || "") !== userId)) return null
    return rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      kind: r.kind as GhcTransaction["kind"],
      amount: Number(r.amount),
      status: r.status as GhcTransaction["status"],
      reason: String(r.reason || ""),
      sourceEvent: String(r.source_event || ""),
      referenceId: r.reference_id != null ? String(r.reference_id) : undefined,
      createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
      postedAt: r.posted_at ? new Date(String(r.posted_at)).getTime() : undefined,
      metadata: (r.metadata as GhcTransaction["metadata"]) || undefined,
    }))
  } catch {
    return null
  }
}

/** Full-ledger wallet totals via SECURITY DEFINER RPC (not limited to recent N rows). */
export async function rpcWalletSnapshot(
  userId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{
  userId: string
  balance: number
  ledgerBalance: number
  locked: number
  pending: number
  lifetimeEarned: number
  lifetimeSpent: number
  lifetimePurchased: number
  updatedAt: number
} | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !userId?.trim() || userId.length > 160) return null
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_wallet_snapshot`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: userId }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    if (!data || typeof data !== "object" || Array.isArray(data)) return null
    // A malformed snapshot must never be rendered as a legitimate zero balance.
    const numeric = ["balance", "ledgerBalance", "locked", "pending", "lifetimeEarned", "lifetimeSpent", "lifetimePurchased"] as const
    const values = Object.fromEntries(numeric.map((key) => [key, Number(data[key] ?? (key === "ledgerBalance" ? data.balance : undefined))])) as Record<(typeof numeric)[number], number>
    if (numeric.some((key) => !Number.isFinite(values[key])) || values.balance < 0 || values.ledgerBalance < 0 ||
        values.locked < 0 || values.pending < 0 || values.lifetimeEarned < 0 || values.lifetimeSpent < 0 || values.lifetimePurchased < 0 ||
        (data.userId != null && String(data.userId) !== userId)) return null
    return {
      userId,
      balance: values.balance,
      ledgerBalance: values.ledgerBalance,
      locked: values.locked,
      pending: values.pending,
      lifetimeEarned: values.lifetimeEarned,
      lifetimeSpent: values.lifetimeSpent,
      lifetimePurchased: values.lifetimePurchased,
      updatedAt: Number.isFinite(Number(data.updatedAt)) && Number(data.updatedAt) > 0 ? Number(data.updatedAt) : Date.now(),
    }
  } catch {
    return null
  }
}

export async function rpcFindTransferByReference(
  referenceId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{ debit?: GhcTransaction; credit?: GhcTransaction } | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !referenceId?.trim() || referenceId.length > 160 || /[\r\n\u0000-\u001f\u007f]/.test(referenceId)) return null
  const url =
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_transactions` +
    `?reference_id=eq.${encodeURIComponent(referenceId)}&status=eq.posted` +
    `&kind=in.(transfer_out,transfer_in)&limit=3`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<Record<string, unknown>>
    if (!Array.isArray(rows) || rows.length > 3 || rows.some((r) => !r || typeof r !== "object" ||
        String(r.reference_id || "") !== referenceId || r.status !== "posted" ||
        !["transfer_out", "transfer_in"].includes(String(r.kind)) || !Number.isFinite(Number(r.amount)) ||
        !String(r.id || "").trim() || !String(r.user_id || "").trim())) return null
    const mapped = rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      kind: r.kind as GhcTransaction["kind"],
      amount: Number(r.amount),
      status: r.status as GhcTransaction["status"],
      reason: String(r.reason || ""),
      sourceEvent: String(r.source_event || ""),
      referenceId: String(r.reference_id || ""),
      createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
    }))
    const debit = mapped.filter((t) => t.kind === "transfer_out")
    const credit = mapped.filter((t) => t.kind === "transfer_in")
    // Duplicate ledger sides are ambiguous; never choose an arbitrary row.
    if (debit.length > 1 || credit.length > 1) return null
    return { debit: debit[0], credit: credit[0] }
  } catch {
    return null
  }
}

export { hasPrivilegedDatabase }

/** --- D6.2 transfer-request RPCs --- */

async function rpcJson(
  fn: string,
  body: Record<string, unknown>,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<Record<string, unknown> | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function rpcCreateTransferRequest(input: {
  requesterId: string
  payerId: string
  amount: number
  referenceId: string
  note?: string
}): Promise<Record<string, unknown> | null> {
  return rpcJson("ghc_create_transfer_request", {
    p_requester_id: input.requesterId,
    p_payer_id: input.payerId,
    p_amount: input.amount,
    p_reference_id: input.referenceId,
    p_note: input.note ?? null,
  })
}

export async function rpcAcceptTransferRequest(input: {
  actorId: string
  referenceId: string
}): Promise<Record<string, unknown> | null> {
  return rpcJson("ghc_accept_transfer_request", {
    p_actor_id: input.actorId,
    p_reference_id: input.referenceId,
  })
}

export async function rpcDeclineTransferRequest(input: {
  actorId: string
  referenceId: string
}): Promise<Record<string, unknown> | null> {
  return rpcJson("ghc_decline_transfer_request", {
    p_actor_id: input.actorId,
    p_reference_id: input.referenceId,
  })
}

export async function rpcCancelTransferRequest(input: {
  actorId: string
  referenceId: string
}): Promise<Record<string, unknown> | null> {
  return rpcJson("ghc_cancel_transfer_request", {
    p_actor_id: input.actorId,
    p_reference_id: input.referenceId,
  })
}

export async function rpcListTransferRequests(
  userId: string,
  direction: "incoming" | "outgoing" | "all" = "all",
  env: GhcServerEnv = readGhcServerEnv()
): Promise<Array<Record<string, unknown>> | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const base = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_transfer_requests`
  const params = new URLSearchParams()
  params.set("order", "created_at.desc")
  params.set("limit", "100")
  if (direction === "incoming") {
    params.set("payer_id", `eq.${userId}`)
  } else if (direction === "outgoing") {
    params.set("requester_id", `eq.${userId}`)
  } else {
    params.set("or", `(payer_id.eq.${userId},requester_id.eq.${userId})`)
  }
  try {
    const res = await fetch(`${base}?${params}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    return (await res.json()) as Array<Record<string, unknown>>
  } catch {
    return null
  }
}

/** Ensure immutable account_created_at for membership trial */
export async function rpcEnsureAccountCreatedAt(
  userId: string,
  hintMs?: number,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{ ok: boolean; accountCreatedAt?: number; created?: boolean; error?: string }> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_ensure_account_created_at`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_hint: hintMs != null ? new Date(hintMs).toISOString() : null,
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      return { ok: false, error: "SERVER_UNAVAILABLE" }
    }
    const data = (await res.json()) as Record<string, unknown>
    if (data && data.ok === false) return { ok: false, error: String(data.error || "FAILED") }
    return {
      ok: true,
      accountCreatedAt: Number(data.accountCreatedAt),
      created: Boolean(data.created),
    }
  } catch {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
}

/**
 * Stage a pending reward hold (kind=pending, status=pending).
 * Amount must already be computed server-side from reward rules — never trust client.
 * Idempotent on (user_id, reference_id) via ghc_stage_pending RPC.
 */
export async function rpcStagePending(
  input: {
    userId: string
    amount: number
    referenceId: string
    reason?: string
    sourceEvent?: string
    ruleId?: string
    /** Per-rule dailyLimit from reward-rules (null = no daily cap check) */
    dailyLimit?: number | null
    /** Per-rule cooldownMs from antiAbuse (null/0 = no cooldown) */
    cooldownMs?: number | null
    /** Per-rule maxPerTargetPerDay (null = no target cap) */
    maxPerTarget?: number | null
    /** Target id for maxPerTarget (reference part[2] encoding) */
    targetId?: string | null
  },
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{
  ok: boolean
  idempotent?: boolean
  alreadyPosted?: boolean
  holdId?: string
  transactionId?: string
  amount?: number
  status?: string
  tx?: Record<string, unknown>
  error?: string
}> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_stage_pending`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: input.userId,
        p_amount: input.amount,
        p_reference_id: input.referenceId,
        p_reason: input.reason || "Reward",
        p_source_event: input.sourceEvent || "SYSTEM",
        p_rule_id: input.ruleId || null,
        p_daily_limit:
          input.dailyLimit != null && Number.isFinite(input.dailyLimit)
            ? Math.floor(Number(input.dailyLimit))
            : null,
        p_cooldown_ms:
          input.cooldownMs != null &&
          Number.isFinite(input.cooldownMs) &&
          input.cooldownMs > 0
            ? Math.floor(Number(input.cooldownMs))
            : null,
        p_max_per_target:
          input.maxPerTarget != null && Number.isFinite(input.maxPerTarget)
            ? Math.floor(Number(input.maxPerTarget))
            : null,
        p_target_id: input.targetId
          ? String(input.targetId).trim() || null
          : null,
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const msg =
        body && typeof body === "object" && "message" in body
          ? String((body as { message: string }).message)
          : "SERVER_UNAVAILABLE"
      return { ok: false, error: msg }
    }
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) {
      return { ok: false, error: String(data?.error || "STAGE_FAILED") }
    }
    return {
      ok: true,
      idempotent: Boolean(data.idempotent),
      alreadyPosted: Boolean(data.alreadyPosted),
      holdId: data.holdId != null ? String(data.holdId) : undefined,
      transactionId:
        data.transactionId != null ? String(data.transactionId) : undefined,
      amount: data.amount != null ? Number(data.amount) : undefined,
      status: data.status != null ? String(data.status) : undefined,
      tx:
        data.tx && typeof data.tx === "object"
          ? (data.tx as Record<string, unknown>)
          : undefined,
    }
  } catch {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
}

/** List only matured Daily Claim V12 holds for the authenticated owner. */
export async function rpcListMaturedDailyClaimHolds(
  userId: string,
  cutoff: Date,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<Array<{ id: string; amount: number; createdAt: number; metadata: Record<string, unknown> }> | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const params = new URLSearchParams({
    select: "id,amount,created_at,metadata",
    user_id: `eq.${userId}`,
    status: "eq.pending",
    source_event: "eq.DAILY_CLAIM_V12",
    amount: "gt.0",
    created_at: `lt.${cutoff.toISOString()}`,
    order: "created_at.asc",
    limit: "100",
  })
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_transactions?${params.toString()}`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: String(row.id),
      amount: Number(row.amount),
      createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : 0,
      metadata: row.metadata && typeof row.metadata === "object"
        ? row.metadata as Record<string, unknown>
        : {},
    })).filter((row) => row.id && Number.isFinite(row.amount) && row.amount > 0 && Number.isFinite(row.createdAt))
  } catch {
    return null
  }
}

/** Server-authoritative claim of pending GHC */

/**
 * Atomic activity emission grant + pending stage (ghc_activity_stage_reward).
 * On limit/cooldown/cap failure: zero net emission consumption (single transaction).
 */
export async function rpcActivityStageReward(
  input: {
    userId: string
    baseAmount: number
    dayKey: string
    weekKey: string
    dailyCap: number
    weeklyCap: number
    referenceId: string
    reason?: string
    sourceEvent?: string
    ruleId?: string
    dailyLimit?: number | null
    cooldownMs?: number | null
    maxPerTarget?: number | null
    targetId?: string | null
    /** Optional post m×g amount; clamped to grant inside RPC */
    stageAmount?: number | null
  },
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{
  ok: boolean
  idempotent?: boolean
  alreadyPosted?: boolean
  holdId?: string
  transactionId?: string
  amount?: number
  status?: string
  granted?: number
  emissionConsumed?: number
  dayRemaining?: number
  weekRemaining?: number
  m?: number
  g?: number
  tx?: Record<string, unknown>
  error?: string
}> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_activity_stage_reward`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: input.userId,
        p_base_amount: input.baseAmount,
        p_day_key: input.dayKey,
        p_week_key: input.weekKey,
        p_daily_cap: input.dailyCap,
        p_weekly_cap: input.weeklyCap,
        p_reference_id: input.referenceId,
        p_reason: input.reason || "Reward",
        p_source_event: input.sourceEvent || "SYSTEM",
        p_rule_id: input.ruleId || null,
        p_daily_limit:
          input.dailyLimit != null && Number.isFinite(input.dailyLimit)
            ? Math.floor(Number(input.dailyLimit))
            : null,
        p_cooldown_ms:
          input.cooldownMs != null &&
          Number.isFinite(input.cooldownMs) &&
          input.cooldownMs > 0
            ? Math.floor(Number(input.cooldownMs))
            : null,
        p_max_per_target:
          input.maxPerTarget != null && Number.isFinite(input.maxPerTarget)
            ? Math.floor(Number(input.maxPerTarget))
            : null,
        p_target_id: input.targetId
          ? String(input.targetId).trim() || null
          : null,
        p_stage_amount:
          input.stageAmount != null && Number.isFinite(input.stageAmount)
            ? Number(input.stageAmount)
            : null,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const msg =
        body && typeof body === "object" && "message" in body
          ? String((body as { message: string }).message)
          : "SERVER_UNAVAILABLE"
      return { ok: false, error: msg }
    }
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) {
      return {
        ok: false,
        error: String((data && data.error) || "STAGE_FAILED"),
        emissionConsumed: Number(data?.emissionConsumed ?? 0) || 0,
      }
    }
    return {
      ok: true,
      idempotent: Boolean(data.idempotent),
      alreadyPosted: Boolean(data.alreadyPosted),
      holdId: data.holdId != null ? String(data.holdId) : undefined,
      transactionId:
        data.transactionId != null ? String(data.transactionId) : undefined,
      amount: data.amount != null ? Number(data.amount) : undefined,
      status: data.status != null ? String(data.status) : undefined,
      granted: data.granted != null ? Number(data.granted) : undefined,
      emissionConsumed:
        data.emissionConsumed != null ? Number(data.emissionConsumed) : undefined,
      dayRemaining:
        data.dayRemaining != null ? Number(data.dayRemaining) : undefined,
      weekRemaining:
        data.weekRemaining != null ? Number(data.weekRemaining) : undefined,
      tx:
        data.tx && typeof data.tx === "object"
          ? (data.tx as Record<string, unknown>)
          : undefined,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "STAGE_FAILED",
      emissionConsumed: 0,
    }
  }
}


export async function rpcClaimPending(
  userId: string,
  holdId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{
  ok: boolean
  alreadyClaimed?: boolean
  transactionId?: string
  amount?: number
  redeemableAt?: string
  error?: string
}> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_claim_pending`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_user_id: userId, p_hold_id: holdId }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      return { ok: false, error: "SERVER_UNAVAILABLE" }
    }
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) {
      return {
        ok: false,
        error: String(data?.error || "NOT_CLAIMABLE"),
        redeemableAt: data?.redeemableAt != null ? String(data.redeemableAt) : undefined,
      }
    }
    return {
      ok: true,
      alreadyClaimed: Boolean(data.alreadyClaimed),
      transactionId: data.transactionId != null ? String(data.transactionId) : undefined,
      amount: data.amount != null ? Number(data.amount) : undefined,
      redeemableAt: data.redeemableAt != null ? String(data.redeemableAt) : undefined,
    }
  } catch {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
}

/** --- ECONOMY_VERSION 1.2: population + claim streak --- */

export type EconomicPopulationStats = {
  ok: boolean
  registeredUsers: number
  verifiedUsers: number
  eligibleEconomicUsers: number
  activeEconomicUsers: number
  suspendedUsers: number
  suspectedDuplicateUsers: number
  source: "database" | "unavailable"
}

export async function rpcEconomicPopulationStats(
  env: GhcServerEnv = readGhcServerEnv()
): Promise<EconomicPopulationStats> {
  const fallback: EconomicPopulationStats = {
    ok: false,
    registeredUsers: 0,
    verifiedUsers: 0,
    eligibleEconomicUsers: 1,
    activeEconomicUsers: 0,
    suspendedUsers: 0,
    suspectedDuplicateUsers: 0,
    source: "unavailable",
  }
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return fallback
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_economic_population_stats`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return fallback
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) return fallback
    const eligible = Math.max(1, Math.floor(Number(data.eligibleEconomicUsers) || 1))
    return {
      ok: true,
      registeredUsers: Math.max(0, Math.floor(Number(data.registeredUsers) || 0)),
      verifiedUsers: Math.max(0, Math.floor(Number(data.verifiedUsers) || 0)),
      eligibleEconomicUsers: eligible,
      activeEconomicUsers: Math.max(0, Math.floor(Number(data.activeEconomicUsers) || 0)),
      suspendedUsers: Math.max(0, Math.floor(Number(data.suspendedUsers) || 0)),
      suspectedDuplicateUsers: Math.max(
        0,
        Math.floor(Number(data.suspectedDuplicateUsers) || 0)
      ),
      source: "database",
    }
  } catch {
    return fallback
  }
}

export type DbClaimStreak = {
  ok: boolean
  userId: string
  cycleDay: number
  completedCycles: number
  lastClaimDayKey: string | null
  totalSuccessfulClaims: number
  economicVersion: string
  lastIdempotencyKey: string | null
  exists: boolean
  error?: string
}

export async function rpcGetClaimStreak(
  userId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<DbClaimStreak> {
  const empty: DbClaimStreak = {
    ok: false,
    userId,
    cycleDay: 0,
    completedCycles: 0,
    lastClaimDayKey: null,
    totalSuccessfulClaims: 0,
    economicVersion: "1.2",
    lastIdempotencyKey: null,
    exists: false,
    error: "SERVER_UNAVAILABLE",
  }
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return empty
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_get_claim_streak`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_user_id: userId }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return empty
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) {
      return { ...empty, error: String(data?.error || "FAILED") }
    }
    if (data.userId != null && String(data.userId) !== userId) return empty
    return {
      ok: true,
      userId: userId,
      cycleDay: Math.max(0, Math.floor(Number(data.cycleDay) || 0)),
      completedCycles: Math.max(0, Math.floor(Number(data.completedCycles) || 0)),
      lastClaimDayKey:
        data.lastClaimDayKey != null && data.lastClaimDayKey !== ""
          ? String(data.lastClaimDayKey).slice(0, 10)
          : null,
      totalSuccessfulClaims: Math.max(
        0,
        Math.floor(Number(data.totalSuccessfulClaims) || 0)
      ),
      economicVersion: String(data.economicVersion || "1.2"),
      lastIdempotencyKey:
        data.lastIdempotencyKey != null ? String(data.lastIdempotencyKey) : null,
      exists: Boolean(data.exists),
    }
  } catch {
    return empty
  }
}

export async function rpcCommitClaimDay(
  input: {
    userId: string
    claimDayKey: string
    cycleDay: number
    completedCycles: number
    idempotencyKey: string
    economicVersion?: string
  },
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{
  ok: boolean
  alreadyClaimed?: boolean
  idempotent?: boolean
  cycleDay?: number
  completedCycles?: number
  lastClaimDayKey?: string | null
  totalSuccessfulClaims?: number
  error?: string
}> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_commit_claim_day`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: input.userId,
        p_claim_day_key: input.claimDayKey,
        p_cycle_day: input.cycleDay,
        p_completed_cycles: input.completedCycles,
        p_idempotency_key: input.idempotencyKey,
        p_economic_version: input.economicVersion || "1.2",
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return { ok: false, error: "SERVER_UNAVAILABLE" }
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) {
      return { ok: false, error: String(data?.error || "COMMIT_FAILED") }
    }
    return {
      ok: true,
      alreadyClaimed: Boolean(data.alreadyClaimed),
      idempotent: Boolean(data.idempotent),
      cycleDay: data.cycleDay != null ? Number(data.cycleDay) : undefined,
      completedCycles:
        data.completedCycles != null ? Number(data.completedCycles) : undefined,
      lastClaimDayKey:
        data.lastClaimDayKey != null ? String(data.lastClaimDayKey).slice(0, 10) : null,
      totalSuccessfulClaims:
        data.totalSuccessfulClaims != null
          ? Number(data.totalSuccessfulClaims)
          : undefined,
    }
  } catch {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
}

/** ECONOMY_VERSION 1.2 — atomic daily claim (streak + ledger, one transaction) */
export type AtomicDailyClaimResult = {
  ok: boolean
  alreadyClaimed?: boolean
  idempotent?: boolean
  cycleDay?: number
  completedCycles?: number
  lastClaimDayKey?: string | null
  totalSuccessfulClaims?: number
  userAmount?: number
  pending?: boolean
  redeemableAt?: string
  reserveAmount?: number
  grossAmount?: number
  baseGross?: number
  m?: number
  g?: number
  missedDayReset?: boolean
  economicVersion?: string
  transactionId?: string
  reserveTransactionId?: string
  referenceId?: string
  error?: string
}

export async function rpcExecuteDailyClaimV12(
  input: {
    userId: string
    claimDayKey: string
    cycleDay: number
    completedCycles: number
    idempotencyKey: string
    grossAmount: number
    userAmount: number
    reserveAmount: number
    baseGross: number
    m: number
    g: number
    economicVersion?: string
    missedDayReset?: boolean
  },
  env: GhcServerEnv = readGhcServerEnv()
): Promise<AtomicDailyClaimResult> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_execute_daily_claim_v12`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: input.userId,
        p_claim_day_key: input.claimDayKey,
        p_cycle_day: input.cycleDay,
        p_completed_cycles: input.completedCycles,
        p_idempotency_key: input.idempotencyKey,
        p_gross_amount: input.grossAmount,
        p_user_amount: input.userAmount,
        p_reserve_amount: input.reserveAmount,
        p_base_gross: input.baseGross,
        p_m: input.m,
        p_g: input.g,
        p_economic_version: input.economicVersion || "1.2",
        p_missed_day_reset: Boolean(input.missedDayReset),
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return {
        ok: false,
        error: res.status >= 500 ? "SERVER_UNAVAILABLE" : text || "CLAIM_FAILED",
      }
    }
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) {
      return { ok: false, error: String(data?.error || "CLAIM_FAILED") }
    }
    return {
      ok: true,
      alreadyClaimed: Boolean(data.alreadyClaimed),
      idempotent: Boolean(data.idempotent),
      cycleDay: data.cycleDay != null ? Number(data.cycleDay) : undefined,
      completedCycles:
        data.completedCycles != null ? Number(data.completedCycles) : undefined,
      lastClaimDayKey:
        data.lastClaimDayKey != null
          ? String(data.lastClaimDayKey).slice(0, 10)
          : null,
      totalSuccessfulClaims:
        data.totalSuccessfulClaims != null
          ? Number(data.totalSuccessfulClaims)
          : undefined,
      userAmount: data.userAmount != null ? Number(data.userAmount) : undefined,
      pending: data.pending != null ? Boolean(data.pending) : false,
      redeemableAt: data.redeemableAt != null ? String(data.redeemableAt) : undefined,
      reserveAmount:
        data.reserveAmount != null ? Number(data.reserveAmount) : undefined,
      grossAmount: data.grossAmount != null ? Number(data.grossAmount) : undefined,
      baseGross: data.baseGross != null ? Number(data.baseGross) : undefined,
      m: data.m != null ? Number(data.m) : undefined,
      g: data.g != null ? Number(data.g) : undefined,
      missedDayReset: Boolean(data.missedDayReset),
      economicVersion:
        data.economicVersion != null ? String(data.economicVersion) : "1.2",
      transactionId:
        data.transactionId != null ? String(data.transactionId) : undefined,
      reserveTransactionId:
        data.reserveTransactionId != null
          ? String(data.reserveTransactionId)
          : undefined,
      referenceId:
        data.referenceId != null ? String(data.referenceId) : input.idempotencyKey,
    }
  } catch {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
}

/** Ops: list transfer_out rows missing matching transfer_in for same reference + recipient. */
export async function listOrphanTransferOuts(
  limit = 50,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{ ok: boolean; orphans: unknown[]; error?: string }> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, orphans: [], error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_list_orphan_transfer_outs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({ p_limit: limit }),
        signal: AbortSignal.timeout(8_000),
      }
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, orphans: [], error: String(data?.error || data?.message || "LIST_FAILED") }
    }
    return { ok: true, orphans: Array.isArray(data.orphans) ? data.orphans : [] }
  } catch {
    return { ok: false, orphans: [], error: "RPC_FAILED" }
  }
}

/**
 * Ops: complete missing transfer_in for an existing posted transfer_out.
 * Does not create a second debit.
 */
export async function completeOrphanTransferIn(
  referenceId: string,
  operatorNote = "ops_complete_orphan_transfer_in",
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{ ok: boolean; error?: string; idempotent?: boolean }> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_complete_orphan_transfer_in`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          p_reference_id: referenceId,
          p_operator_note: operatorNote.slice(0, 160),
        }),
        signal: AbortSignal.timeout(8_000),
      }
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      return { ok: false, error: String(data?.error || data?.message || "COMPLETE_FAILED") }
    }
    return { ok: true, idempotent: Boolean(data.idempotent) }
  } catch {
    return { ok: false, error: "RPC_FAILED" }
  }
}
