/**
 * Payment intent store — process memory (replace with ghc_payment_intents table).
 */
import type {
  PaymentIntent,
  PaymentIntentStatus,
  CreatePaymentIntentInput,
  PaymentIntentAuditEvent,
} from "./intent-types"

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

export function createPaymentIntent(input: CreatePaymentIntentInput): PaymentIntent {
  if (input.idempotencyKey) {
    const existingId = byIdempotency().get(input.idempotencyKey)
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
  map().set(intent.id, intent)
  if (input.idempotencyKey) {
    byIdempotency().set(input.idempotencyKey, intent.id)
  }
  return intent
}

export function getPaymentIntent(id: string): PaymentIntent | null {
  return map().get(id) || null
}

export function getByProviderPaymentId(providerPaymentId: string): PaymentIntent | null {
  const id = byProvider().get(providerPaymentId)
  if (!id) {
    // linear scan fallback
    for (const intent of map().values()) {
      if (intent.providerPaymentId === providerPaymentId) return intent
    }
    return null
  }
  return map().get(id) || null
}

export function listIntentsForUser(userId: string): PaymentIntent[] {
  return [...map().values()]
    .filter((i) => i.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

const ALLOWED: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  CREATED: ["APPROVAL_PENDING", "CANCELLED", "FAILED"],
  APPROVAL_PENDING: ["APPROVED", "CANCELLED", "FAILED"],
  APPROVED: ["USER_SUBMITTED", "COMPLETION_PENDING", "CANCELLED", "FAILED"],
  USER_SUBMITTED: ["COMPLETION_PENDING", "COMPLETED", "FAILED", "CANCELLED"],
  COMPLETION_PENDING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: ["REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
}

export function transitionIntent(
  id: string,
  to: PaymentIntentStatus,
  opts?: {
    actor?: string
    detail?: string
    providerPaymentId?: string
    txid?: string
    error?: string
    meta?: Record<string, unknown>
  }
): { ok: true; intent: PaymentIntent } | { ok: false; error: string; intent?: PaymentIntent } {
  const intent = map().get(id)
  if (!intent) return { ok: false, error: "INTENT_NOT_FOUND" }

  if (intent.status === to) {
    // idempotent no-op
    return { ok: true, intent }
  }

  const allowed = ALLOWED[intent.status] || []
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `INVALID_TRANSITION:${intent.status}->${to}`,
      intent,
    }
  }

  intent.status = to
  const now = Date.now()
  if (to === "APPROVED") intent.approvedAt = now
  if (to === "USER_SUBMITTED") intent.submittedAt = now
  if (to === "COMPLETED") intent.completedAt = now
  if (to === "CANCELLED") intent.cancelledAt = now
  if (to === "REFUNDED") intent.refundedAt = now
  if (opts?.providerPaymentId) {
    intent.providerPaymentId = opts.providerPaymentId
    byProvider().set(opts.providerPaymentId, intent.id)
  }
  if (opts?.txid) intent.txid = opts.txid
  if (opts?.error) intent.lastError = opts.error
  if (to === "COMPLETED" || to === "APPROVED") intent.lastError = null

  audit(intent, to, opts?.actor, opts?.detail, opts?.meta)
  map().set(intent.id, intent)
  return { ok: true, intent }
}

export function bindProviderPayment(
  intentId: string,
  providerPaymentId: string,
  actor?: string
): PaymentIntent | null {
  const intent = map().get(intentId)
  if (!intent) return null
  // Conflict if another intent owns this provider id
  const existing = getByProviderPaymentId(providerPaymentId)
  if (existing && existing.id !== intentId) {
    audit(intent, "BIND_CONFLICT", actor, `providerPaymentId owned by ${existing.id}`)
    return null
  }
  intent.providerPaymentId = providerPaymentId
  byProvider().set(providerPaymentId, intentId)
  if (intent.status === "CREATED") {
    intent.status = "APPROVAL_PENDING"
  }
  audit(intent, "BIND_PROVIDER", actor, providerPaymentId)
  map().set(intentId, intent)
  return intent
}

/** Incomplete intents that may need recovery */
export function listRecoverable(userId?: string): PaymentIntent[] {
  const open: PaymentIntentStatus[] = [
    "CREATED",
    "APPROVAL_PENDING",
    "APPROVED",
    "USER_SUBMITTED",
    "COMPLETION_PENDING",
  ]
  return [...map().values()].filter(
    (i) =>
      open.includes(i.status) &&
      (!userId || i.userId === userId) &&
      Date.now() - i.createdAt < 7 * 86400000
  )
}
