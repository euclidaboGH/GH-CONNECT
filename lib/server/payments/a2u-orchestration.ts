/**
 * Phase 7 — Shared Pi A2U payout orchestration helpers.
 *
 * Rules:
 * - Never mark paid solely because createPayment/submit was called
 * - Prefer recovering a matching incomplete payment over creating a new one
 * - Unrelated incomplete payments → durable attention + review queue
 * - Provider binding: direction, network, recipient, amount, metadata, verified tx
 * - Testnet-only for this release path
 */
import type { PiBackendPayment } from "pi-backend"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export type A2uSourceKind = "cashback" | "seller_marketplace" | "creator" | "other"

export type A2uBinding = {
  paymentId: string
  requestId: string
  recipientUid: string
  amount: number
  txid?: string
  /** Expected metadata.payoutRequestId / direction */
  requirePayoutRequestId?: boolean
}

export function amountMatchesPi(expected: number, actual: unknown): boolean {
  const value = typeof actual === "number" ? actual : typeof actual === "string" ? Number(actual) : NaN
  return Number.isFinite(value) && Math.abs(value - expected) < 1e-8
}

/** Strict provider binding — required before any paid settlement. */
export function providerPaymentMatchesA2u(
  payment: PiBackendPayment,
  input: A2uBinding,
): boolean {
  if (!payment || payment.identifier !== input.paymentId) return false
  if (payment.direction !== "app_to_user") return false
  if (payment.network !== "Pi Testnet") return false
  if (payment.user_uid !== input.recipientUid) return false
  if (!amountMatchesPi(input.amount, payment.amount)) return false
  if (payment.status?.cancelled === true || payment.status?.user_cancelled === true) return false
  if (input.requirePayoutRequestId !== false) {
    if (String(payment.metadata?.direction || "") !== "a2u") return false
    if (String(payment.metadata?.payoutRequestId || "") !== input.requestId) return false
  }
  if (input.txid) {
    const tx = payment.transaction?.txid
    if (tx !== input.txid) return false
    const verified =
      payment.status?.transaction_verified === true || payment.transaction?.verified === true
    if (!verified) return false
  }
  return true
}

export function isProviderDeveloperCompleted(payment: PiBackendPayment): boolean {
  return payment.status?.developer_completed === true
}

/**
 * From incomplete server payments, pick the one bound to this requestId + recipient + amount.
 * Never invent a payment id.
 */
export function findMatchingIncompleteA2u(
  incomplete: PiBackendPayment[],
  input: { requestId: string; recipientUid: string; amount: number },
): PiBackendPayment | undefined {
  return incomplete.find(
    (p) =>
      String(p.metadata?.payoutRequestId || "") === input.requestId &&
      String(p.metadata?.direction || "") === "a2u" &&
      p.user_uid === input.recipientUid &&
      amountMatchesPi(input.amount, p.amount),
  )
}

export function hasUnrelatedIncompleteA2u(
  incomplete: PiBackendPayment[],
  requestId: string,
): boolean {
  return incomplete.some((p) => String(p.metadata?.payoutRequestId || "") !== requestId)
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

export async function enqueueA2uReview(input: {
  sourceKind: A2uSourceKind
  sourceRequestId: string
  userId: string
  reasonCode: string
  providerPaymentId?: string
  txid?: string
  amountAtomic?: number
  detail?: string
}): Promise<{ ok: boolean; reviewId?: string; duplicate?: boolean; error?: string }> {
  const result = await rpc<{
    ok?: boolean
    reviewId?: string
    duplicate?: boolean
    error?: string
  }>("gh_pi_a2u_review_enqueue", {
    p_source_kind: input.sourceKind,
    p_source_request_id: input.sourceRequestId,
    p_user_id: input.userId,
    p_reason_code: input.reasonCode,
    p_provider_payment_id: input.providerPaymentId || null,
    p_txid: input.txid || null,
    p_amount_atomic: input.amountAtomic ?? null,
    p_detail: input.detail || null,
  })
  if (!result) return { ok: false, error: "REVIEW_QUEUE_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "ENQUEUE_FAILED") }
  return { ok: true, reviewId: result.reviewId, duplicate: result.duplicate === true }
}

export async function listOpenA2uReviews(limit = 50) {
  return rpc<{ ok?: boolean; items?: unknown[]; error?: string }>("gh_pi_a2u_review_list_open", {
    p_limit: limit,
  })
}

export async function listStuckA2uJobs(olderThanMinutes = 30) {
  return rpc<{
    ok?: boolean
    cashback?: unknown[]
    seller?: unknown[]
    error?: string
  }>("gh_pi_a2u_list_stuck_jobs", {
    p_older_than_minutes: olderThanMinutes,
  })
}

export async function resolveA2uReview(input: {
  reviewId: string
  status: "resolved" | "dismissed"
  note?: string
}) {
  return rpc<{ ok?: boolean; error?: string }>("gh_pi_a2u_review_resolve", {
    p_review_id: input.reviewId,
    p_status: input.status,
    p_note: input.note || null,
  })
}

/**
 * Settlement gate: paid only when provider completed + binding matches + optional evidence hash path.
 * Returns false if any required check fails — callers must NOT write paid status.
 */
export function canMarkA2uPaid(input: {
  payment: PiBackendPayment
  binding: A2uBinding
}): { ok: true } | { ok: false; error: string } {
  if (!providerPaymentMatchesA2u(input.payment, input.binding)) {
    return { ok: false, error: "PROVIDER_BINDING_MISMATCH" }
  }
  if (!isProviderDeveloperCompleted(input.payment)) {
    return { ok: false, error: "PROVIDER_NOT_COMPLETED" }
  }
  if (!input.binding.txid) {
    return { ok: false, error: "TXID_REQUIRED" }
  }
  if (!providerPaymentMatchesA2u(input.payment, { ...input.binding, txid: input.binding.txid })) {
    return { ok: false, error: "TXID_UNVERIFIED" }
  }
  return { ok: true }
}
