/**
 * Payment intent store — durable when Supabase is configured; memory fallback for studio.
 * Production correctness must NOT depend on process memory alone.
 */
import { randomUUID } from "node:crypto"
import { isAllowedPaymentTransition } from "@/lib/server/payments/intent-transition-policy.mjs"
import type {
  PaymentIntent,
  PaymentIntentStatus,
  CreatePaymentIntentInput,
  PaymentIntentAuditEvent,
} from "./intent-types"

export type { PaymentIntent, PaymentIntentStatus, CreatePaymentIntentInput } from "./intent-types"
import { readGhcServerEnv } from "@/lib/server/economy/env"

function isPaymentProd(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  )
}

const g = globalThis as unknown as {
  __ghPaymentIntents?: Map<string, PaymentIntent>
  __ghPaymentIntentsByProvider?: Map<string, string>
  __ghPaymentIntentsByIdempotency?: Map<string, string>
}

function map(): Map<string, PaymentIntent> {
  if (!g.__ghPaymentIntents) g.__ghPaymentIntents = new Map()
  return g.__ghPaymentIntents
}

function byProvider(): Map<string, string> {
  if (!g.__ghPaymentIntentsByProvider) g.__ghPaymentIntentsByProvider = new Map()
  return g.__ghPaymentIntentsByProvider
}

function byIdempotency(): Map<string, string> {
  if (!g.__ghPaymentIntentsByIdempotency) g.__ghPaymentIntentsByIdempotency = new Map()
  return g.__ghPaymentIntentsByIdempotency
}

function genId(): string {
  return `pi_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "")}`
}

function audit(
  intent: PaymentIntent,
  action: string,
  actor?: string,
  detail?: string,
  meta?: Record<string, unknown>
): void {
  const ev: PaymentIntentAuditEvent = {
    at: Date.now(),
    action,
    actor,
    detail,
    meta,
  }
  intent.audit = [...(intent.audit || []), ev].slice(-50)
}

function dbConfigured(): boolean {
  const env = readGhcServerEnv()
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
}

async function rpcJson(
  fn: string,
  body: Record<string, unknown>
): Promise<unknown | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
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
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    )
    if (!res.ok) return null
    const text = await res.text()
    if (!text || text === "null") return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isValidIntentRow(row: Record<string, unknown>): boolean {
  const statuses = new Set<PaymentIntentStatus>([
    "CREATED", "APPROVAL_PENDING", "APPROVED", "USER_SUBMITTED", "COMPLETION_PENDING",
    "COMPLETED", "FULFILLED", "FAILED", "CANCELLED", "REFUNDED", "INCOMPLETE",
  ])
  const purposes = new Set(["membership", "marketplace", "boost", "donation", "sponsored_listing", "digital_product", "premium_feature", "service", "verification", "seller_payout", "creator_earning", "refund", "reward_payout", "other"])
  return typeof row.id === "string" && row.id.length > 0 &&
    typeof row.userId === "string" && row.userId.length > 0 &&
    purposes.has(String(row.purpose)) && typeof row.referenceId === "string" && row.referenceId.length > 0 &&
    (row.provider === "pi" || row.provider === "ghc_internal" || row.provider === "manual") &&
    Number.isFinite(Number(row.amount)) && Number(row.amount) > 0 &&
    (row.currency === "PI" || row.currency === "GHC") && statuses.has(row.status as PaymentIntentStatus)
}

function rowToIntent(row: Record<string, unknown>): PaymentIntent {
  return {
    id: String(row.id),
    userId: String(row.userId),
    provider: (row.provider as PaymentIntent["provider"]) || "pi",
    providerPaymentId: row.providerPaymentId != null ? String(row.providerPaymentId) : null,
    purpose: row.purpose as PaymentIntent["purpose"],
    amount: Number(row.amount),
    currency: (row.currency as "PI" | "GHC") || "PI",
    status: row.status as PaymentIntentStatus,
    referenceId: String(row.referenceId || ""),
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: Number(row.createdAt) || Date.now(),
    approvedAt: row.approvedAt != null ? Number(row.approvedAt) : undefined,
    submittedAt: row.submittedAt != null ? Number(row.submittedAt) : undefined,
    completedAt: row.completedAt != null ? Number(row.completedAt) : undefined,
    fulfilledAt: row.fulfilledAt != null ? Number(row.fulfilledAt) : undefined,
    cancelledAt: row.cancelledAt != null ? Number(row.cancelledAt) : undefined,
    refundedAt: row.refundedAt != null ? Number(row.refundedAt) : undefined,
    txid: row.txid != null ? String(row.txid) : null,
    lastError: row.lastError != null ? String(row.lastError) : null,
    audit: Array.isArray(row.audit) ? (row.audit as PaymentIntentAuditEvent[]) : [],
    idempotencyKey: row.idempotencyKey != null ? String(row.idempotencyKey) : null,
  }
}

function intentToRow(intent: PaymentIntent): Record<string, unknown> {
  return {
    id: intent.id,
    userId: intent.userId,
    provider: intent.provider,
    providerPaymentId: intent.providerPaymentId,
    purpose: intent.purpose,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    referenceId: intent.referenceId,
    metadata: intent.metadata,
    txid: intent.txid ?? null,
    lastError: intent.lastError ?? null,
    idempotencyKey: intent.idempotencyKey ?? null,
    audit: intent.audit || [],
    createdAt: intent.createdAt,
    approvedAt: intent.approvedAt ?? null,
    submittedAt: intent.submittedAt ?? null,
    completedAt: intent.completedAt ?? null,
    fulfilledAt: intent.fulfilledAt ?? null,
    cancelledAt: intent.cancelledAt ?? null,
    refundedAt: intent.refundedAt ?? null,
  }
}

function cachePut(intent: PaymentIntent): void {
  map().set(intent.id, intent)
  if (intent.providerPaymentId) {
    byProvider().set(intent.providerPaymentId, intent.id)
  }
  if (intent.idempotencyKey) {
    byIdempotency().set(`${intent.userId}:${intent.idempotencyKey}`, intent.id)
  }
}


async function persistCritical(intent: PaymentIntent): Promise<PaymentIntent | null> {
  const pr = await persist(intent)
  if (pr.ok) return intent
  if (isPaymentProd() || dbConfigured()) {
    console.error("[payment-intent] durable persist failed", pr.error)
    return null
  }
  // Studio without DB: memory cache already updated in persist()
  return intent
}

async function persist(intent: PaymentIntent): Promise<{ ok: boolean; error?: string }> {
  if (!dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.isProduction || isPaymentProd()) {
      return {
        ok: false,
        error: "DURABLE_REQUIRED: production requires Supabase payment intents schema",
      }
    }
    cachePut(intent)
    return { ok: true }
  }
  const res = await rpcJson("ghc_payment_intent_upsert", { p_row: intentToRow(intent) })
  if (res == null || typeof res !== "object" || (res as Record<string, unknown>).ok !== true) {
    return {
      ok: false,
      error: "DURABLE_WRITE_FAILED: ghc_payment_intent_upsert unavailable or migration not applied",
    }
  }
  // Cache only after durable confirmation; failed writes must not become local truth.
  cachePut(intent)
  return { ok: true }
}

/** Production: DB required. Studio: memory allowed. */
export async function assertDurableWrite(
  intent: PaymentIntent
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (dbConfigured()) {
    const persisted = await loadFromDbById(intent.id)
    if (!persisted) return { ok: false, error: "DURABLE_READ_FAILED" }
    if (
      persisted.userId !== intent.userId || persisted.purpose !== intent.purpose ||
      persisted.amount !== intent.amount || persisted.currency !== intent.currency ||
      persisted.referenceId !== intent.referenceId
    ) return { ok: false, error: "DURABLE_INTENT_IDENTITY_MISMATCH" }
    return { ok: true }
  }
  const result = await persist(intent)
  if (!result.ok) return { ok: false, error: result.error || "DURABLE_WRITE_FAILED" }
  return { ok: true }
}

async function loadFromDbById(id: string): Promise<PaymentIntent | null> {
  const data = await rpcJson("ghc_payment_intent_get", { p_id: id })
  if (!data || typeof data !== "object" || !isValidIntentRow(data as Record<string, unknown>)) return null
  const intent = rowToIntent(data as Record<string, unknown>)
  cachePut(intent)
  return intent
}

async function loadFromDbByProvider(providerPaymentId: string): Promise<PaymentIntent | null> {
  const data = await rpcJson("ghc_payment_intent_by_provider", {
    p_provider_payment_id: providerPaymentId,
  })
  if (!data || typeof data !== "object" || !isValidIntentRow(data as Record<string, unknown>)) return null
  const intent = rowToIntent(data as Record<string, unknown>)
  cachePut(intent)
  return intent
}

async function loadFromDbByIdempotency(userId: string, idempotencyKey: string): Promise<PaymentIntent | null> {
  const data = await rpcJson("ghc_payment_intent_by_idempotency", {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
  })
  if (!data || typeof data !== "object" || !isValidIntentRow(data as Record<string, unknown>)) return null
  const intent = rowToIntent(data as Record<string, unknown>)
  cachePut(intent)
  return intent
}

function intentFromAtomicRpc(data: unknown): PaymentIntent | null {
  if (!data || typeof data !== "object") return null
  const envelope = data as Record<string, unknown>
  if (envelope.ok !== true || !envelope.intent || typeof envelope.intent !== "object") return null
  const row = envelope.intent as Record<string, unknown>
  if (!isValidIntentRow(row)) return null
  const intent = rowToIntent(row)
  cachePut(intent)
  return intent
}

function idempotencyMatches(intent: PaymentIntent, input: CreatePaymentIntentInput): boolean {
  return intent.userId === input.userId &&
    intent.purpose === input.purpose &&
    intent.amount === input.amount &&
    intent.currency === (input.currency || "PI") &&
    intent.referenceId === input.referenceId &&
    intent.provider === (input.provider || "pi")
}

/** Sync cache read — prefer async loadPaymentIntent when durability matters */
export function getPaymentIntent(id: string): PaymentIntent | null {
  /** Synchronous cache access is for display/Studio compatibility only. Production
   * authority decisions must use loadPaymentIntent and must not fall back on read failure. */
  return map().get(id) || null
}

export async function loadPaymentIntent(id: string): Promise<PaymentIntent | null> {
  // Prefer durable record so completed/refunded state is not masked by stale process cache
  if (dbConfigured()) {
    const fromDb = await loadFromDbById(id)
    if (fromDb) {
      map().set(fromDb.id, fromDb)
      return fromDb
    }
    // Production: DB is authority. Do not treat process-memory-only intents as durable truth.
    // (RPC null covers both "not found" and transport errors — never invent durable state.)
    if (isPaymentProd()) {
      return null
    }
  }
  return map().get(id) || null
}

export function getByProviderPaymentId(providerPaymentId: string): PaymentIntent | null {
  const id = byProvider().get(providerPaymentId)
  if (!id) return null
  return map().get(id) || null
}

export async function loadByProviderPaymentId(
  providerPaymentId: string
): Promise<PaymentIntent | null> {
  if (dbConfigured()) {
    const fromDb = await loadFromDbByProvider(providerPaymentId)
    if (fromDb) {
      cachePut(fromDb)
      return fromDb
    }
    if (isPaymentProd()) return null
  }
  return getByProviderPaymentId(providerPaymentId)
}

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
  const purposes = new Set(["membership", "marketplace", "boost", "donation", "sponsored_listing", "digital_product", "premium_feature", "service", "verification", "seller_payout", "creator_earning", "refund", "reward_payout", "other"])
  const provider = input.provider || "pi"
  const currency = input.currency || "PI"
  if (
    typeof input.userId !== "string" || !input.userId.trim() || input.userId.length > 256 || /[\u0000-\u001f\u007f]/.test(input.userId) ||
    typeof input.referenceId !== "string" || !input.referenceId.trim() || input.referenceId.length > 240 || /[\u0000-\u001f\u007f]/.test(input.referenceId) ||
    !purposes.has(input.purpose) || !["pi", "ghc_internal", "manual"].includes(provider) || !["PI", "GHC"].includes(currency) ||
    !Number.isFinite(input.amount) || input.amount <= 0 || input.amount >= 10_000_000_000 || Number(input.amount.toFixed(8)) !== input.amount
  ) {
    throw new Error("INVALID_PAYMENT_INTENT_INPUT")
  }
  input = { ...input, userId: input.userId.trim(), referenceId: input.referenceId.trim(), provider, currency }
  const rawIdempotencyKey = input.idempotencyKey
  if (rawIdempotencyKey !== undefined) {
    if (typeof rawIdempotencyKey !== "string") throw new Error("INVALID_IDEMPOTENCY_KEY")
    const normalizedKey = rawIdempotencyKey.trim()
    if (!normalizedKey || normalizedKey.length > 200 || /[\u0000-\u001f\u007f]/.test(normalizedKey)) {
      throw new Error("INVALID_IDEMPOTENCY_KEY")
    }
    input = { ...input, idempotencyKey: normalizedKey }
  }
  if (input.idempotencyKey) {
    let existing: PaymentIntent | null = null
    if (dbConfigured()) existing = await loadFromDbByIdempotency(input.userId, input.idempotencyKey)
    else if (!isPaymentProd()) {
      const existingId = byIdempotency().get(`${input.userId}:${input.idempotencyKey}`)
      existing = existingId ? map().get(existingId) || null : null
    }
    if (existing) {
      if (!idempotencyMatches(existing, input)) throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST")
      return existing
    }
    if (isPaymentProd() && !dbConfigured()) throw new Error("PAYMENT_INTENT_DURABILITY_UNAVAILABLE")
  }

  // Bind intent to deployment network (sandbox vs mainnet) for cross-env rejection on approve.
  let networkEnv: "sandbox" | "mainnet" = "sandbox"
  try {
    const { resolvePiSandbox } = require("@/lib/pi-env") as {
      resolvePiSandbox: (o?: { hostname?: string | null }) => boolean
    }
    networkEnv = resolvePiSandbox() ? "sandbox" : "mainnet"
  } catch {
    networkEnv =
      process.env.NEXT_PUBLIC_PI_SANDBOX === "false" ||
      (process.env.VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_PI_SANDBOX !== "true")
        ? "mainnet"
        : "sandbox"
  }

  const intent: PaymentIntent = {
    id: genId(),
    userId: input.userId,
    provider: input.provider || "pi",
    providerPaymentId: null,
    purpose: input.purpose,
    amount: input.amount,
    currency: input.currency || "PI",
    status: "CREATED",
    referenceId: input.referenceId,
    metadata: {
      ...(input.metadata || {}),
      environment: networkEnv,
      currency: input.currency || "PI",
    },
    createdAt: Date.now(),
    txid: null,
    lastError: null,
    audit: [],
    idempotencyKey: input.idempotencyKey || null,
  }
  audit(intent, "CREATED", input.userId, `Payment intent created (${networkEnv})`)
  const durable = await persistCritical(intent)
  if (durable) return durable
  // Two concurrent requests can both miss the initial lookup. If the unique DB
  // idempotency constraint accepted the other request first, return that exact intent.
  if (input.idempotencyKey && dbConfigured()) {
    const raced = await loadFromDbByIdempotency(input.userId, input.idempotencyKey)
    if (raced) {
      if (!idempotencyMatches(raced, input)) throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST")
      return raced
    }
  }
  throw new Error(isPaymentProd() ? "PAYMENT_INTENT_DURABILITY_UNAVAILABLE" : "payment intent persist failed")
}

export async function bindProviderPayment(
  intentId: string,
  providerPaymentId: string,
  actor?: string
): Promise<PaymentIntent | null> {
  intentId = String(intentId || "").trim()
  providerPaymentId = String(providerPaymentId || "").trim()
  if (!intentId || intentId.length > 200 || !providerPaymentId || providerPaymentId.length > 200 || /[\u0000-\u001f\u007f]/.test(providerPaymentId)) return null
  if (dbConfigured()) {
    const result = await rpcJson("ghc_payment_intent_bind_provider", {
      p_id: intentId,
      p_provider_payment_id: providerPaymentId,
      p_actor: actor || null,
    })
    return intentFromAtomicRpc(result)
  }
  const loaded = isPaymentProd() ? await loadPaymentIntent(intentId) : map().get(intentId) || null
  if (!loaded) return null
  const intent: PaymentIntent = { ...loaded, metadata: { ...loaded.metadata }, audit: [...loaded.audit] }
  if (intent.providerPaymentId && intent.providerPaymentId !== providerPaymentId) return null
  if (!intent.providerPaymentId && ["COMPLETED", "FULFILLED", "FAILED", "CANCELLED", "REFUNDED"].includes(intent.status)) return null
  const existing = isPaymentProd()
    ? await loadByProviderPaymentId(providerPaymentId)
    : (() => { const existingId = byProvider().get(providerPaymentId); return existingId ? map().get(existingId) || null : null })()
  if (existing && existing.id !== intentId) {
    if (existing.userId !== intent.userId || existing.providerPaymentId !== providerPaymentId) {
      audit(intent, "BIND_CONFLICT", actor, "providerPaymentId already belongs to another intent")
      return null
    }
    return existing
  }
  intent.providerPaymentId = providerPaymentId
  byProvider().set(providerPaymentId, intentId)
  if (intent.status === "CREATED") {
    intent.status = "APPROVAL_PENDING"
  }
  audit(intent, "BIND_PROVIDER", actor, providerPaymentId)
  return await persistCritical(intent)
}

export async function transitionIntent(
  intentId: string,
  next: PaymentIntentStatus,
  opts?: {
    actor?: string
    detail?: string
    providerPaymentId?: string
    txid?: string
    error?: string
    meta?: Record<string, unknown>
  }
): Promise<PaymentIntent | null> {
  intentId = String(intentId || "").trim()
  if (!intentId || intentId.length > 200) return null
  if (dbConfigured()) {
    const result = await rpcJson("ghc_payment_intent_transition", {
      p_id: intentId,
      p_next_status: next,
      p_actor: opts?.actor || null,
      p_detail: opts?.detail || null,
      p_provider_payment_id: opts?.providerPaymentId || null,
      p_txid: opts?.txid || null,
      p_error: opts?.error || null,
      p_meta: opts?.meta || {},
    })
    return intentFromAtomicRpc(result)
  }
  const loaded = isPaymentProd() ? await loadPaymentIntent(intentId) : map().get(intentId) || null
  if (!loaded) return null
  const intent: PaymentIntent = { ...loaded, metadata: { ...loaded.metadata }, audit: [...loaded.audit] }

  if (opts?.providerPaymentId && intent.providerPaymentId !== opts.providerPaymentId) return null
  if (intent.status === next) {
    if (opts?.txid) intent.txid = opts.txid
    if (opts?.error !== undefined) intent.lastError = opts.error || null
    audit(intent, `STATUS_${next}`, opts?.actor, opts?.detail, opts?.meta)
    return (await persistCritical(intent)) || null
  }
  const terminal = ["FULFILLED", "REFUNDED", "FAILED", "CANCELLED"]
  if (terminal.includes(intent.status)) return null
  if (intent.status === "COMPLETED" && next !== "FULFILLED" && next !== "REFUNDED") return null
  if (next === "FULFILLED" && intent.status !== "COMPLETED") return null
  if (next === "REFUNDED" && intent.status !== "COMPLETED") return null

  if (!isAllowedPaymentTransition(intent.status, next)) return null
  if (opts?.providerPaymentId) {
    const providerPaymentId = String(opts.providerPaymentId).trim()
    if (!providerPaymentId || providerPaymentId.length > 200 || /[\u0000-\u001f\u007f]/.test(providerPaymentId)) return null
    if (intent.providerPaymentId !== providerPaymentId) return null
    const existingIntentId = byProvider().get(providerPaymentId)
    if (existingIntentId && existingIntentId !== intentId) return null
  }

  intent.status = next
  if (opts?.txid) intent.txid = opts.txid
  if (opts?.error) intent.lastError = opts.error

  const now = Date.now()
  if (next === "APPROVED") intent.approvedAt = now
  if (next === "USER_SUBMITTED") intent.submittedAt = now
  if (next === "COMPLETED") intent.completedAt = now
  if (next === "FULFILLED") intent.fulfilledAt = now
  if (next === "CANCELLED") intent.cancelledAt = now
  if (next === "REFUNDED") intent.refundedAt = now

  audit(intent, `STATUS_${next}`, opts?.actor, opts?.detail, opts?.meta)
  const durable = await persistCritical(intent)
  if (!durable) return null
  return durable
}

/** Mark fulfilled exactly once after COMPLETED */
export async function markIntentFulfilled(
  intentId: string,
  actor?: string
): Promise<PaymentIntent | null> {
  const intent = isPaymentProd() ? await loadPaymentIntent(intentId) : map().get(intentId) || null
  if (!intent) return null
  if (intent.status === "FULFILLED") return intent
  // After FULFILLED early-return, only COMPLETED may transition to FULFILLED.
  if (intent.status !== "COMPLETED") return intent
  return await transitionIntent(intentId, "FULFILLED", {
    actor,
    detail: "Benefit granted",
  })
}

export function listRecoverable(userId?: string): PaymentIntent[] {
  if (isPaymentProd()) return []
  const open: PaymentIntentStatus[] = [
    "CREATED",
    "APPROVAL_PENDING",
    "APPROVED",
    "USER_SUBMITTED",
    "COMPLETION_PENDING",
    "INCOMPLETE",
  ]
  return [...map().values()].filter(
    (i) =>
      open.includes(i.status) &&
      (!userId || i.userId === userId) &&
      Date.now() - i.createdAt < 7 * 86400000
  )
}

export function listIntentsForUser(userId: string): PaymentIntent[] {
  if (isPaymentProd()) return []
  return [...map().values()]
    .filter((i) => i.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * List intents for a user from durable store when configured.
 * Falls back to process memory (studio) so cold starts still work offline.
 */
export async function listIntentsForUserAsync(userId: string): Promise<PaymentIntent[]> {
  const uid = String(userId || "").trim()
  if (!uid) return []

  if (!dbConfigured()) {
    if (isPaymentProd()) throw new Error("PAYMENT_INTENT_STORE_UNAVAILABLE")
    return listIntentsForUser(uid)
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    if (isPaymentProd()) throw new Error("PAYMENT_INTENT_STORE_UNAVAILABLE")
    return listIntentsForUser(uid)
  }

  try {
    const base = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_payment_intents`
    const params = new URLSearchParams()
    params.set("user_id", `eq.${uid}`)
    params.set("order", "created_at.desc")
    params.set("limit", "100")
    params.set(
      "select",
      "id,user_id,provider,provider_payment_id,purpose,amount,currency,status,reference_id,metadata,txid,last_error,idempotency_key,audit,created_at,approved_at,submitted_at,completed_at,fulfilled_at,cancelled_at,refunded_at"
    )
    const res = await fetch(`${base}?${params}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      if (isPaymentProd()) {
        throw new Error("PAYMENT_INTENT_STORE_UNAVAILABLE")
      }
      return listIntentsForUser(uid)
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>
    if (!Array.isArray(rows)) {
      if (isPaymentProd()) throw new Error("PAYMENT_INTENT_STORE_UNAVAILABLE")
      return listIntentsForUser(uid)
    }

    const intents: PaymentIntent[] = []
    for (const row of rows) {
      const mapped = {
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        providerPaymentId: row.provider_payment_id,
        purpose: row.purpose,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        referenceId: row.reference_id,
        metadata: row.metadata,
        txid: row.txid,
        lastError: row.last_error,
        idempotencyKey: row.idempotency_key,
        audit: row.audit,
        createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
        approvedAt: row.approved_at ? new Date(String(row.approved_at)).getTime() : undefined,
        submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).getTime() : undefined,
        completedAt: row.completed_at ? new Date(String(row.completed_at)).getTime() : undefined,
        fulfilledAt: row.fulfilled_at ? new Date(String(row.fulfilled_at)).getTime() : undefined,
        cancelledAt: row.cancelled_at ? new Date(String(row.cancelled_at)).getTime() : undefined,
        refundedAt: row.refunded_at ? new Date(String(row.refunded_at)).getTime() : undefined,
      }
      if (!isValidIntentRow(mapped)) throw new Error("PAYMENT_INTENT_STORE_UNAVAILABLE")
      const intent = rowToIntent(mapped)
      cachePut(intent)
      intents.push(intent)
    }
    return intents
  } catch (e) {
    if (isPaymentProd()) {
      if (e instanceof Error && e.message === "PAYMENT_INTENT_STORE_UNAVAILABLE") throw e
      throw new Error("PAYMENT_INTENT_STORE_UNAVAILABLE")
    }
    return listIntentsForUser(uid)
  }
}

/** Whether store can use durable backend */
export function paymentIntentsDurable(): boolean {
  return dbConfigured()
}
