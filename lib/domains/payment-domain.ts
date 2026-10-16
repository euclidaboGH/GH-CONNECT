/**
 * PaymentDomain — abstraction for future external / Pi payments.
 *
 * Rules:
 * - Client can initiate and track status.
 * - Client cannot mark payment verified/completed in a way that credits GHC.
 * - Only applyServerVerification() (backend-authoritative path) may move to
 *   verified/completed and optionally credit GHC via economy.
 * - No speculative Pi SDK or blockchain implementation.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import { domainEvents } from "../realtime/event-bus"
import type {
  PaymentIntent,
  PaymentProviderId,
  PaymentLifecycleStatus,
  InitiatePaymentInput,
  ServerPaymentVerification,
} from "./payment-types"
import { PI_PAYMENT_READINESS } from "./payment-types"
import type { DomainServices } from "./create-domains"

const STORAGE_KEY = "ghc_payment_intents_v1"

function genId() {
  return `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function loadIntents(userId: string): PaymentIntent[] {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const all = JSON.parse(raw) as Record<string, PaymentIntent[]>
    return all[userId] || []
  } catch {
    return []
  }
}

function saveIntents(userId: string, intents: PaymentIntent[]) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = intents.slice(-200)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

function allowedStatusTransition(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus
): boolean {
  const map: Record<PaymentLifecycleStatus, PaymentLifecycleStatus[]> = {
    initiated: ["pending", "cancelled", "failed"],
    pending: ["verified", "failed", "cancelled"],
    verified: ["completed", "failed", "refunded"],
    completed: ["refunded"],
    failed: [],
    cancelled: [],
    refunded: [],
  }
  return map[from]?.includes(to) ?? false
}

export function createPaymentDomain(deps: {
  currentUserId?: string
  getServices?: () => DomainServices | null
  /**
   * Optional HTTP endpoint for server verification.
   * When set, client posts verification claims here; server decides.
   */
  verificationEndpoint?: string
}) {
  const userId = deps.currentUserId || "current-user"

  function getIntent(id: string): PaymentIntent | undefined {
    return loadIntents(userId).find((p) => p.id === id)
  }

  function upsert(intent: PaymentIntent) {
    const list = loadIntents(userId)
    const idx = list.findIndex((p) => p.id === intent.id)
    if (idx >= 0) list[idx] = intent
    else list.unshift(intent)
    saveIntents(userId, list)
  }

  return {
    getReadinessNotes() {
      return PI_PAYMENT_READINESS
    },

    listIntents(limit = 50): PaymentIntent[] {
      return loadIntents(userId)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
    },

    getIntent,

    /**
     * Start a payment. Does not credit GHC.
     * For pi_network: records intent only — actual Pi SDK call is future/backend work.
     */
    async initiate(
      input: InitiatePaymentInput
    ): Promise<MutationResult<{ intent: PaymentIntent }>> {
      return runMutation({
        name: "payment.initiate",
        actorId: userId,
        input,
        validate: (i) => {
          if (!i.amount || i.amount <= 0) return "Invalid amount"
          if (!i.currency?.trim()) return "Currency required"
          if (i.provider === "unknown") return "Provider required"
          if (i.ghcCredit !== undefined && i.ghcCredit < 0) return "Invalid GHC credit"
          return null
        },
        mutate: (i) => {
          const intent: PaymentIntent = {
            id: genId(),
            userId,
            provider: i.provider,
            purpose: i.purpose,
            amount: i.amount,
            currency: i.currency.trim(),
            ghcCredit: i.ghcCredit,
            status: "initiated",
            metadata: i.metadata,
            referenceId: i.referenceId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            serverVerified: false,
          }
          upsert(intent)
          domainEvents.publish(
            "PAYMENT_INITIATED",
            {
              paymentId: intent.id,
              provider: intent.provider,
              purpose: intent.purpose,
            },
            userId,
            intent.id
          )
          return { intent }
        },
      })
    },

    /**
     * Client may mark pending / cancelled / failed for UX only.
     * Cannot set verified, completed, or serverVerified.
     */
    async clientUpdateStatus(
      paymentId: string,
      status: "pending" | "cancelled" | "failed",
      failureReason?: string
    ): Promise<MutationResult<{ intent: PaymentIntent }>> {
      return runMutation({
        name: "payment.clientUpdateStatus",
        actorId: userId,
        input: { paymentId, status, failureReason },
        validate: (i) => {
          const intent = getIntent(i.paymentId)
          if (!intent) return "Payment not found"
          if (intent.userId !== userId) return "Not your payment"
          if (!allowedStatusTransition(intent.status, i.status)) {
            return `Cannot move from ${intent.status} to ${i.status}`
          }
          return null
        },
        mutate: (i) => {
          const intent = { ...getIntent(i.paymentId)! }
          intent.status = i.status
          intent.updatedAt = Date.now()
          if (i.failureReason) intent.failureReason = i.failureReason
          // Explicit: never allow client to set serverVerified
          intent.serverVerified = false
          upsert(intent)
          return { intent }
        },
      })
    },

    /**
     * Authoritative path — intended to be called only after backend verifies provider.
     *
     * In production: API route validates provider signature / Pi payment DTO,
     * then invokes this with serverVerified semantics.
     *
     * Local prototype: requires explicit `authorityToken` marker to reduce accidental client credit.
     * Real deployments must enforce this exclusively server-side.
     */
    async applyServerVerification(
      verification: ServerPaymentVerification,
      options?: {
        /** Prototype guard — production should use authenticated admin/service role */
        authorityToken?: string
        creditGhc?: boolean
      }
    ): Promise<MutationResult<{ intent: PaymentIntent; economyTxId?: string }>> {
      return runMutation({
        name: "payment.applyServerVerification",
        actorId: userId,
        input: { verification, options },
        validate: (i) => {
          // SECURITY: Never trust client-provided payment success.
          // Production: this mutation must only run on the server (API route / worker).
          // The token alone is not cryptographic auth — it only blocks accidental UX calls.
          if (i.options?.authorityToken !== "server-authoritative") {
            return "Payment verification must be server-authoritative"
          }
          if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
            return "Payment verification is server-only in production"
          }
          const intent = getIntent(i.verification.paymentIntentId)
          if (!intent) return "Payment intent not found"
          if (!i.verification.verified) return "Provider did not verify payment"
          if (i.verification.amount !== intent.amount) {
            return "Amount mismatch — refusing credit"
          }
          if (
            i.verification.currency.toLowerCase() !== intent.currency.toLowerCase()
          ) {
            return "Currency mismatch — refusing credit"
          }
          if (intent.status === "completed" || intent.status === "refunded") {
            return "Payment already finalized"
          }
          return null
        },
        mutate: async (i) => {
          const intent = { ...getIntent(i.verification.paymentIntentId)! }
          if (!allowedStatusTransition(intent.status, "verified") && intent.status !== "verified") {
            // allow pending → verified
            if (intent.status !== "pending" && intent.status !== "initiated") {
              throw new Error(`Invalid status ${intent.status} for verification`)
            }
          }
          intent.status = "verified"
          intent.serverVerified = true
          intent.providerRef = i.verification.providerRef
          intent.verifiedAt = i.verification.verifiedAt || Date.now()
          intent.updatedAt = Date.now()
          upsert(intent)

          domainEvents.publish(
            "PAYMENT_VERIFIED",
            { paymentId: intent.id, provider: intent.provider },
            userId,
            intent.id
          )

          let economyTxId: string | undefined

          // Credit GHC only after server verification, when purpose/top-up requests it
          const shouldCredit =
            i.options?.creditGhc !== false &&
            intent.ghcCredit &&
            intent.ghcCredit > 0 &&
            (intent.purpose === "ghc_topup" || intent.purpose === "other")

          if (shouldCredit) {
            const services = deps.getServices?.()
            if (!services?.economy?.creditPurchase) {
              throw new Error("Economy not available for credit")
            }
            const credited = await services.economy.creditPurchase({
              amount: intent.ghcCredit!,
              paymentRef: intent.id,
              reason: `Payment ${intent.provider} verified top-up`,
              serverAuthority: true,
            })
            if (!credited.ok) {
              throw new Error(credited.error || "Failed to credit GHC")
            }
            economyTxId = credited.data?.tx?.id
            intent.economyTxId = economyTxId
          }

          intent.status = "completed"
          intent.completedAt = Date.now()
          intent.updatedAt = Date.now()
          upsert(intent)

          domainEvents.publish(
            "PAYMENT_COMPLETED",
            {
              paymentId: intent.id,
              provider: intent.provider,
              economyTxId,
            },
            userId,
            intent.id
          )

          return { intent, economyTxId }
        },
      })
    },

    /**
     * Optional: POST intent to backend verification endpoint (scaffold).
     * Does not implement provider-specific logic.
     */
    async requestBackendVerification(paymentId: string): Promise<{ ok: boolean; error?: string }> {
      const intent = getIntent(paymentId)
      if (!intent) return { ok: false, error: "Not found" }
      const endpoint = deps.verificationEndpoint
      if (!endpoint) {
        return {
          ok: false,
          error: "No verification endpoint configured — set when backend is ready",
        }
      }
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: intent.id,
            provider: intent.provider,
            providerRef: intent.providerRef,
            amount: intent.amount,
            currency: intent.currency,
          }),
        })
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Network error" }
      }
    },

    /**
     * Pi readiness helper — documents intended flow; no Pi SDK calls.
     */
    preparePiPaymentIntent(input: {
      amount: number
      purpose: InitiatePaymentInput["purpose"]
      ghcCredit?: number
      referenceId?: string
    }) {
      return this.initiate({
        provider: "pi_network",
        purpose: input.purpose,
        amount: input.amount,
        currency: "PI",
        ghcCredit: input.ghcCredit,
        referenceId: input.referenceId,
        metadata: {
          note: "Awaiting server-side Pi payment verification; client must not credit GHC",
          readiness: PI_PAYMENT_READINESS.intendedFlow,
        },
      })
    },

    async markRefunded(
      paymentId: string,
      reason: string
    ): Promise<MutationResult<{ intent: PaymentIntent }>> {
      return runMutation({
        name: "payment.markRefunded",
        actorId: userId,
        input: { paymentId, reason },
        validate: (i) => {
          const intent = getIntent(i.paymentId)
          if (!intent) return "Not found"
          if (!intent.serverVerified) return "Only server-verified payments can be refunded here"
          if (!allowedStatusTransition(intent.status, "refunded")) {
            return "Invalid refund transition"
          }
          return null
        },
        mutate: (i) => {
          const intent = { ...getIntent(i.paymentId)! }
          intent.status = "refunded"
          intent.updatedAt = Date.now()
          intent.failureReason = i.reason
          upsert(intent)
          domainEvents.publish(
            "PAYMENT_REFUNDED",
            { paymentId: intent.id },
            userId,
            intent.id
          )
          return { intent }
        },
      })
    },
  }
}

export type PaymentDomain = ReturnType<typeof createPaymentDomain>
