/**
 * Payment intent store — durable when Supabase is configured; memory fallback for studio.
 * Production correctness must NOT depend on process memory alone.
 */
import type {
  PaymentIntent,
  PaymentIntentStatus,
  CreatePaymentIntentInput,
  PaymentIntentAuditEvent,
} from "./intent-types"
import { PAYMENT_STATUS_RANK } from "./intent-types"
import { readGhcServerEnv } from "@/lib/server/economy/env"

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
  return `pi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
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

async function persist(intent: PaymentIntent): Promise<{ ok: boolean; error?: string }> {
  cachePut(intent)
  if (!dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.isProduction) {
      return {
        ok: false,
        error: "DURABLE_REQUIRED: production requires Supabase payment intents schema",
      }
    }
    return { ok: true }
  }
  const res = await rpcJson("ghc_payment_intent_upsert", { p_row: intentToRow(intent) })
  if (res == null) {
    return {
      ok: false,
      error: "DURABLE_WRITE_FAILED: ghc_payment_intent_upsert unavailable or migration not applied",
    }
  }
  return { ok: true }
}

/** Production: DB required. Studio: memory allowed. */
export async function assertDurableWrite(
  intent: PaymentIntent
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await persist(intent)
  if (!result.ok) return { ok: false, error: result.error || "DURABLE_WRITE_FAILED" }
  return { ok: true }
}

async function loadFromDbById(id: string): Promise<PaymentIntent | null> {
  const data = await rpcJson("ghc_payment_intent_get", { p_id: id })
  if (!data || typeof data !== "object") return null
  const intent = rowToIntent(data as Record<string, unknown>)
  cachePut(intent)
  return intent
}

async function loadFromDbByProvider(providerPaymentId: string): Promise<PaymentIntent | null> {
  const data = await rpcJson("ghc_payment_intent_by_provider", {
    p_provider_payment_id: providerPaymentId,
  })
  if (!data || typeof data !== "object") return null
  const intent = rowToIntent(data as Record<string, unknown>)
  cachePut(intent)
  return intent
}

/** Sync cache read — prefer async loadPaymentIntent when durability matters */
export function getPaymentIntent(id: string): PaymentIntent | null {
  return map().get(id) || null
}

export async function loadPaymentIntent(id: string): Promise<PaymentIntent | null> {
  const mem = map().get(id)
  if (mem) return mem
  return loadFromDbById(id)
}

export function getByProviderPaymentId(providerPaymentId: string): PaymentIntent | null {
  const id = byProvider().get(providerPaymentId)
  if (!id) return null
  return map().get(id) || null
}

export async function loadByProviderPaymentId(
  providerPaymentId: string
): Promise<PaymentIntent | null> {
  const mem = getByProviderPaymentId(providerPaymentId)
  if (mem) return mem
  return loadFromDbByProvider(providerPaymentId)
}

export function createPaymentIntent(input: CreatePaymentIntentInput): PaymentIntent {
  if (input.idempotencyKey) {
    const existingId = byIdempotency().get(`${input.userId}:${input.idempotencyKey}`)
    if (existingId) {
      const existing = map().get(existingId)
      if (existing) return existing
    }
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
    metadata: input.metadata || {},
    createdAt: Date.now(),
    txid: null,
    lastError: null,
    audit: [],
    idempotencyKey: input.idempotencyKey || null,
  }
  audit(intent, "CREATED", input.userId, "Payment intent created")
  cachePut(intent)
  void persist(intent)
  return intent
}

export function bindProviderPayment(
  intentId: string,
  providerPaymentId: string,
  actor?: string
): PaymentIntent | null {
  const intent = map().get(intentId)
  if (!intent) return null
  const existingId = byProvider().get(providerPaymentId)
  if (existingId && existingId !== intentId) {
    const existing = map().get(existingId)
    if (existing && existing.userId !== intent.userId) {
      audit(intent, "BIND_CONFLICT", actor, `providerPaymentId owned by ${existing.id}`)
      void persist(intent)
      return null
    }
  }
  intent.providerPaymentId = providerPaymentId
  byProvider().set(providerPaymentId, intentId)
  if (intent.status === "CREATED") {
    intent.status = "APPROVAL_PENDING"
  }
  audit(intent, "BIND_PROVIDER", actor, providerPaymentId)
  void persist(intent)
  return intent
}

export function transitionIntent(
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
): PaymentIntent | null {
  const intent = map().get(intentId)
  if (!intent) return null

  const terminal = ["FULFILLED", "REFUNDED"]
  if (terminal.includes(intent.status) && next !== intent.status) {
    audit(intent, "TRANSITION_BLOCKED", opts?.actor, `${intent.status} → ${next}`)
    return intent
  }

  // Allow same-status idempotent refresh; block true regressions except FAILED/CANCELLED targets
  const curRank = PAYMENT_STATUS_RANK[intent.status] ?? 0
  const nextRank = PAYMENT_STATUS_RANK[next] ?? 0
  if (
    nextRank < curRank &&
    !["FAILED", "CANCELLED", "REFUNDED", "INCOMPLETE"].includes(next) &&
    intent.status !== next
  ) {
    // Exception: allow INCOMPLETE annotation without wiping COMPLETED
    if (intent.status === "COMPLETED" || intent.status === "FULFILLED") {
      return intent
    }
  }

  intent.status = next
  if (opts?.providerPaymentId) {
    intent.providerPaymentId = opts.providerPaymentId
    byProvider().set(opts.providerPaymentId, intentId)
  }
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
  void persist(intent)
  return intent
}

/** Mark fulfilled exactly once after COMPLETED */
export function markIntentFulfilled(
  intentId: string,
  actor?: string
): PaymentIntent | null {
  const intent = map().get(intentId)
  if (!intent) return null
  if (intent.status === "FULFILLED") return intent
  if (intent.status !== "COMPLETED" && intent.status !== "FULFILLED") {
    audit(intent, "FULFILL_BLOCKED", actor, `status=${intent.status}`)
    void persist(intent)
    return intent
  }
  return transitionIntent(intentId, "FULFILLED", {
    actor,
    detail: "Benefit granted",
  })
}

export function listRecoverable(userId?: string): PaymentIntent[] {
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
  return [...map().values()]
    .filter((i) => i.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** Whether store can use durable backend */
export function paymentIntentsDurable(): boolean {
  return dbConfigured()
}
