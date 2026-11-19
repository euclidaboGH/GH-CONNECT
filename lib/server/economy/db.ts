/**
 * Server-only GHC database access.
 * Privileged credentials never leave this module to the client.
 */

import { readGhcServerEnv, hasPrivilegedDatabase, type GhcServerEnv } from "./env"
import { supabaseRpc, supabaseRest, getServiceSupabaseConfig } from "@/lib/server/supabase/rest-client"
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

  try {
    const rpcResult = await supabaseRpc('ghc_execute_transfer', {
        p_sender_id: input.senderId,
        p_to_user_id: input.toUserId,
        p_amount: input.amount,
        p_reference_id: input.referenceId,
        p_note: input.note ?? null,
        p_request_id: input.requestId ?? null,
      }, { timeoutMs: 12000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
  env: GhcServerEnv = readGhcServerEnv(),
  options: { limit?: number; before?: { createdAt: string; id: string }; from?: string; to?: string; status?: "pending" | "posted" | "failed" | "reversed" | "expired"; kind?: "earned" | "spent" | "purchased" | "pending" | "reversed" | "expired" | "adjusted" | "transfer_out" | "transfer_in" | "transfer_request"; q?: string } = {}
): Promise<GhcTransaction[] | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const requestedLimit = Number(options.limit ?? 500)
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100, 1), 500)
  const params = new URLSearchParams({
    user_id: `eq.${userId}`,
    order: "created_at.desc,id.desc",
    limit: String(limit),
  })
  if (options.from) params.set("created_at", `gte.${options.from}T00:00:00.000Z`)
  if (options.status) params.set("status", `eq.${options.status}`)
  if (options.kind) params.set("kind", `eq.${options.kind}`)
  const andFilters: string[] = []
  if (options.to) andFilters.push(`created_at.lte.${options.to}T23:59:59.999Z`)
  const search = String(options.q || "").normalize("NFKC").trim().replace(/[%,()\\*]/g, " ").replace(/\s+/g, " ").slice(0, 120)
  for (const token of search.split(" ").filter(Boolean).slice(0, 6)) andFilters.push(`or(reason.ilike.*${token}*,source_event.ilike.*${token}*,reference_id.ilike.*${token}*)`)
  if (andFilters.length) params.set("and", `(${andFilters.join(",")})`)
  if (options.before) {
    // The caller validates the cursor timestamp and UUID before this query.
    // Preserve the exact database timestamp (including sub-millisecond precision).
    const { createdAt, id } = options.before
    params.set("or", `(created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id}))`)
  }
  try {
    const restResult = await supabaseRest<Array<Record<string, unknown>>>(
      `ghc_transactions?${params.toString()}`,
      { method: "GET", timeoutMs: 8_000 },
    )
    if (!restResult.ok) return null
    const rows = (Array.isArray(restResult.data) ? restResult.data : []) as Array<Record<string, unknown>>
    if (!Array.isArray(rows) || rows.length > limit || rows.some((r) => !r || typeof r !== "object" ||
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
      createdAtCursor: r.created_at == null ? undefined : String(r.created_at),
      postedAt: r.posted_at ? new Date(String(r.posted_at)).getTime() : undefined,
      metadata: (r.metadata as GhcTransaction["metadata"]) || undefined,
    }))
  } catch {
    return null
  }
}

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
  try {
    const rpcResult = await supabaseRpc('ghc_wallet_snapshot', { p_user_id: userId }, { timeoutMs: 12000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
  const path =
    "ghc_transactions" +
    `?reference_id=eq.${encodeURIComponent(referenceId)}&status=eq.posted` +
    `&kind=in.(transfer_out,transfer_in)&limit=3`
  try {
    const restResult = await supabaseRest<Array<Record<string, unknown>>>(path, {
      method: "GET",
      timeoutMs: 8_000,
    })
    if (!restResult.ok) return null
    const rows = (Array.isArray(restResult.data) ? restResult.data : []) as Array<Record<string, unknown>>
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
  _env: GhcServerEnv = readGhcServerEnv()
): Promise<Record<string, unknown> | null> {
  const result = await supabaseRpc<Record<string, unknown>>(fn, body, { timeoutMs: 8_000 })
  if (!result.ok) return null
  return result.data
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
    const restResult = await supabaseRest<Array<Record<string, unknown>>>(
      `ghc_transfer_requests?${params}`,
      { method: "GET", timeoutMs: 8_000 },
    )
    if (!restResult.ok) return null
    return (Array.isArray(restResult.data) ? restResult.data : null) as Array<Record<string, unknown>> | null
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
  try {
    const rpcResult = await supabaseRpc('ghc_ensure_account_created_at', {
        p_user_id: userId,
        p_hint: hintMs != null ? new Date(hintMs).toISOString() : null,
      }, { timeoutMs: 8000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
  try {
    const rpcResult = await supabaseRpc('ghc_stage_pending', {
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
      }, { timeoutMs: 8000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
  try {
    const restResult = await supabaseRest<Array<Record<string, unknown>>>(
      `ghc_transactions?${params.toString()}`,
      { method: "GET", timeoutMs: 12_000 },
    )
    if (!restResult.ok) return null
    const rows = (Array.isArray(restResult.data) ? restResult.data : []) as Array<Record<string, unknown>>
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
  try {
    const rpcResult = await supabaseRpc('ghc_activity_stage_reward', {
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
      }, { timeoutMs: 8000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
  try {
    const rpcResult = await supabaseRpc('ghc_claim_pending', { p_user_id: userId, p_hold_id: holdId }, { timeoutMs: 8000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
    eligibleEconomicUsers: 0,
    activeEconomicUsers: 0,
    suspendedUsers: 0,
    suspectedDuplicateUsers: 0,
    source: "unavailable",
  }
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return fallback
  try {
    const rpcResult = await supabaseRpc('ghc_economic_population_stats', {}, { timeoutMs: 8000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
if (!res.ok) return fallback
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) return fallback
    const fields = [data.registeredUsers, data.verifiedUsers, data.eligibleEconomicUsers, data.activeEconomicUsers, data.suspendedUsers, data.suspectedDuplicateUsers]
    if (fields.some((value) => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      || Number(data.eligibleEconomicUsers) < 1) return fallback
    return {
      ok: true,
      registeredUsers: Number(data.registeredUsers),
      verifiedUsers: Number(data.verifiedUsers),
      eligibleEconomicUsers: Number(data.eligibleEconomicUsers),
      activeEconomicUsers: Number(data.activeEconomicUsers),
      suspendedUsers: Number(data.suspendedUsers),
      suspectedDuplicateUsers: Number(data.suspectedDuplicateUsers),
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
  try {
    const rpcResult = await supabaseRpc('ghc_get_claim_streak', { p_user_id: userId }, { timeoutMs: 8000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
  try {
    const rpcResult = await supabaseRpc('ghc_commit_claim_day', {
        p_user_id: input.userId,
        p_claim_day_key: input.claimDayKey,
        p_cycle_day: input.cycleDay,
        p_completed_cycles: input.completedCycles,
        p_idempotency_key: input.idempotencyKey,
        p_economic_version: input.economicVersion || "1.2",
      }, { timeoutMs: 12000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
  globalDemandAfter?: number
  globalBudget?: number
  error?: string
}

/** Atomic Daily Claim v13: the database owns population, demand, governor and split. */
export async function rpcExecuteDailyClaimV13(
  input: {
    userId: string
    claimDayKey: string
    cycleDay: number
    completedCycles: number
    idempotencyKey: string
    eligibleEconomicUsers: number
    economicVersion?: string
    missedDayReset?: boolean
  },
  env: GhcServerEnv = readGhcServerEnv()
): Promise<AtomicDailyClaimResult> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "SERVER_UNAVAILABLE" }
  if (!Number.isSafeInteger(input.eligibleEconomicUsers) || input.eligibleEconomicUsers < 1) {
    return { ok: false, error: "ECONOMIC_POPULATION_UNAVAILABLE" }
  }
  if (!Number.isSafeInteger(input.cycleDay) || input.cycleDay < 1 || input.cycleDay > 7
    || !Number.isSafeInteger(input.completedCycles) || input.completedCycles < 0 || input.completedCycles > 1_000_000_000
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.claimDayKey)
    || !/^[A-Za-z0-9._:-]{8,160}$/.test(input.idempotencyKey)) {
    return { ok: false, error: "INVALID_DAILY_CLAIM_V13_INPUT" }
  }
  try {
    const result = await supabaseRpc<Record<string, unknown>>("ghc_execute_daily_claim_v13", {
      p_user_id: input.userId,
      p_claim_day_key: input.claimDayKey,
      p_cycle_day: input.cycleDay,
      p_completed_cycles: input.completedCycles,
      p_idempotency_key: input.idempotencyKey,
      p_eligible_users: input.eligibleEconomicUsers,
      p_economic_version: input.economicVersion || "1.2",
      p_missed_day_reset: Boolean(input.missedDayReset),
    }, { timeoutMs: 12_000 })
    if (!result.ok) return { ok: false, error: "SERVER_UNAVAILABLE" }
    const data = result.data
    if (!data || data.ok !== true) return { ok: false, error: String(data?.error || "CLAIM_FAILED") }
    const num = (key: string): number | null => {
      const value = data[key]
      return typeof value === "number" && Number.isFinite(value) ? value : null
    }
    const userAmount = num("userAmount")
    const reserveAmount = num("reserveAmount")
    const grossAmount = num("grossAmount")
    const baseGross = num("baseGross")
    const m = num("m")
    const g = num("g")
    const globalDemandAfter = num("globalDemandAfter")
    const globalBudget = num("globalBudget")
    const alreadyClaimed = data.alreadyClaimed === true
    const expectedBase = [0.39, 0.62, 0.86, 1.09, 1.33, 1.56, 1.96][input.cycleDay - 1]
    const curveN = Math.max(10, input.eligibleEconomicUsers)
    const expectedM = Math.max(0.18, Math.min(1, 0.18 + 0.82 / Math.pow(1 + 0.2 * (Math.log(curveN / 10) / Math.log(10)), 1.15)))
    const expectedBudget = 8 * Math.pow(input.eligibleEconomicUsers, 0.85)
    const expectedG = globalDemandAfter !== null && globalBudget !== null && globalDemandAfter > 0
      ? Math.max(0, Math.min(1, globalBudget / globalDemandAfter)) : 1
    const expectedGross = baseGross !== null && m !== null && g !== null ? Math.round(baseGross * m * g * 1_000_000) / 1_000_000 : -1
    const expectedUser = grossAmount !== null ? Math.floor(grossAmount * 0.8 * 1_000_000) / 1_000_000 : -1
    if ([userAmount, reserveAmount, grossAmount, baseGross, m, g, globalDemandAfter, globalBudget].some((v) => v === null)
      || userAmount! < 0 || reserveAmount! < 0 || grossAmount! <= 0 || baseGross! <= 0
      || m! < 0 || m! > 1 || g! < 0 || g! > 1 || globalDemandAfter! < 0 || globalBudget! <= 0
      || Math.abs((userAmount! + reserveAmount!) - grossAmount!) > 0.000002
      || (!alreadyClaimed && (Math.abs(baseGross! - expectedBase) > 1e-9
        || Math.abs(m! - expectedM) > 1e-9 || Math.abs(g! - expectedG) > 1e-9
        || Math.abs(globalBudget! - expectedBudget) > 1e-6
        || Math.abs(grossAmount! - expectedGross) > 0.000002 || Math.abs(userAmount! - expectedUser) > 0.000002
        || data.pending !== true || typeof data.redeemableAt !== "string" || !Number.isFinite(Date.parse(data.redeemableAt))))) {
      return { ok: false, error: "DAILY_CLAIM_RESPONSE_INVALID" }
    }
    return {
      ok: true,
      alreadyClaimed,
      idempotent: data.idempotent === true || alreadyClaimed,
      cycleDay: typeof data.cycleDay === "number" ? data.cycleDay : input.cycleDay,
      completedCycles: typeof data.completedCycles === "number" ? data.completedCycles : input.completedCycles,
      lastClaimDayKey: typeof data.lastClaimDayKey === "string" ? data.lastClaimDayKey.slice(0, 10) : input.claimDayKey,
      totalSuccessfulClaims: typeof data.totalSuccessfulClaims === "number" ? data.totalSuccessfulClaims : undefined,
      userAmount: userAmount!,
      pending: data.pending === true,
      redeemableAt: typeof data.redeemableAt === "string" ? data.redeemableAt : undefined,
      reserveAmount: reserveAmount!,
      grossAmount: grossAmount!,
      baseGross: baseGross!,
      m: m!,
      g: g!,
      globalDemandAfter: globalDemandAfter!,
      globalBudget: globalBudget!,
      missedDayReset: data.missedDayReset === true,
      economicVersion: typeof data.economicVersion === "string" ? data.economicVersion : input.economicVersion || "1.2",
      transactionId: typeof data.transactionId === "string" ? data.transactionId : undefined,
      reserveTransactionId: typeof data.reserveTransactionId === "string" ? data.reserveTransactionId : undefined,
      referenceId: typeof data.referenceId === "string" ? data.referenceId : input.idempotencyKey,
    }
  } catch {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
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
  try {
    const rpcResult = await supabaseRpc('ghc_execute_daily_claim_v12', {
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
      }, { timeoutMs: 12000 })
    const res = {
      ok: rpcResult.ok,
      status: rpcResult.status,
      json: async () => rpcResult.ok ? rpcResult.data : rpcResult.body,
      text: async () => JSON.stringify(rpcResult.ok ? rpcResult.data : rpcResult.body),
    }
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
    const rpcResult = await supabaseRpc<Record<string, unknown>>(
      "ghc_list_orphan_transfer_outs",
      { p_limit: limit },
      { timeoutMs: 8_000 },
    )
    const data = rpcResult.ok ? rpcResult.data : null
    if (!rpcResult.ok || !data || data.ok !== true) {
      return { ok: false, orphans: [], error: String((data && (data.error || data.message)) || "LIST_FAILED") }
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
    const rpcResult = await supabaseRpc<Record<string, unknown>>(
      "ghc_complete_orphan_transfer_in",
      {
        p_reference_id: referenceId,
        p_operator_note: operatorNote.slice(0, 160),
      },
      { timeoutMs: 8_000 },
    )
    const data = rpcResult.ok ? rpcResult.data : null
    if (!rpcResult.ok || !data || data.ok !== true) {
      return { ok: false, error: String((data && (data.error || data.message)) || "COMPLETE_FAILED") }
    }
    return { ok: true, idempotent: Boolean(data.idempotent) }
  } catch {
    return { ok: false, error: "RPC_FAILED" }
  }
}
