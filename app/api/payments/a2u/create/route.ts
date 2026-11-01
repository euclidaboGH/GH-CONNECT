/**
 * POST /api/payments/a2u/create
 * Full server-side Pi A2U execution through the official pi-backend SDK.
 * Testnet only. A durable payout must already be approved and in processing state.
 * This route is privileged, serialized globally, idempotent, and reconciles the provider
 * transaction before the seller payout can become paid.
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { assertPayoutWalletAuthorization } from "@/lib/server/identity/wallet-authorization"
import { findMatchingIncompleteA2u, enqueueA2uReview } from "@/lib/server/payments/a2u-orchestration"
import { resolvePiSandbox } from "@/lib/pi-env"
import type { PiBackendPayment } from "pi-backend"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
}
function authorized(request: Request): boolean {
  const expected = Buffer.from(String(process.env.GHC_A2U_ADMIN_KEY || ""), "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-a2u-admin-key") || ""), "utf8")
  return expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
function amountMatches(expected: number, actual: unknown): boolean {
  const n = typeof actual === "number" ? actual : typeof actual === "string" ? Number(actual) : NaN
  return Number.isFinite(n) && Math.abs(n - expected) < 1e-8
}
function hasVerifiedTransaction(payment: PiBackendPayment, txid: string): boolean {
  return payment.transaction?.txid === txid &&
    (payment.status?.transaction_verified === true || payment.transaction?.verified === true)
}
function providerMatches(payment: PiBackendPayment, input: { paymentId: string; requestId: string; recipientUid: string; amount: number; txid?: string }) {
  return payment.identifier === input.paymentId &&
    payment.direction === "app_to_user" && payment.network === "Pi Testnet" &&
    payment.user_uid === input.recipientUid && amountMatches(input.amount, payment.amount) &&
    String(payment.metadata?.direction || "") === "a2u" &&
    String(payment.metadata?.payoutRequestId || "") === input.requestId &&
    (input.txid ? hasVerifiedTransaction(payment, input.txid) : true) &&
    payment.status?.cancelled !== true && payment.status?.user_cancelled !== true
}

async function rpc<T>(base: string, key: string, name: string, body: Record<string, unknown>): Promise<T | null> {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20_000),
  })
  const data = await response.json().catch(() => null) as T | null
  if (!response.ok) throw new Error(`RPC_${name.toUpperCase()}_HTTP_${response.status}`)
  return data
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rl = checkRateLimit("a2u-create-privileged", 3, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)

  // A2U is currently Testnet-only. Never infer a safe network from deployment defaults.
  if (process.env.PI_A2U_ENABLED !== "true" || process.env.PI_A2U_TESTNET_ONLY !== "true" || !resolvePiSandbox() || process.env.PI_ENV !== "production") {
    return reply({ ok: false, error: "PI_A2U_DISABLED", message: "A2U is Testnet-only and requires PI_A2U_ENABLED=true, PI_A2U_TESTNET_ONLY=true, NEXT_PUBLIC_PI_SANDBOX=true, and PI_ENV=production for the official SDK configuration bundle." }, 503)
  }
  const apiKey = String(process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()
  const walletSeed = String(process.env.PI_WALLET_PRIVATE_SEED || "").trim()
  if (!apiKey || !/^S[A-Z2-7]{55}$/.test(walletSeed)) {
    return reply({ ok: false, error: "PI_A2U_SERVER_CREDENTIALS_MISSING", message: "Configure the Pi server API key and app-wallet private seed in the server-side secret store." }, 503)
  }

  const parsedBody = await readBoundedJson(request, 64 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value
  const requestId = String(body?.payoutRequestId || "").trim()
  if (!/^spr_[a-f0-9]{16,40}$/i.test(requestId)) return reply({ ok: false, error: "INVALID_PAYOUT_REQUEST_ID" }, 400)

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  const base = env.supabaseUrl.replace(/\/$/, "")
  const key = env.supabaseServiceRoleKey
  const payoutResponse = await fetch(`${base}/rest/v1/gh_seller_payout_requests?${new URLSearchParams({ id: `eq.${requestId}`, select: "id,seller_id,currency,amount,status", limit: "1" })}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  })
  if (!payoutResponse.ok) return reply({ ok: false, error: "PAYOUT_LOOKUP_UNAVAILABLE" }, 503)
  const payoutRows = await payoutResponse.json() as Array<{ id: string; seller_id: string; currency: string; amount: number; status: string }>
  const payout = Array.isArray(payoutRows) ? payoutRows[0] : undefined
  if (!payout) return reply({ ok: false, error: "PAYOUT_NOT_FOUND" }, 404)
  if (payout.status === "paid") return reply({ ok: true, idempotent: true, requestId, status: "paid", paid: true })
  const payoutAmount = Number(payout.amount)
  // Stellar native-asset amounts are represented to at most seven decimal places.
  if (payout.currency !== "PI" || payout.status !== "processing" || !Number.isFinite(payoutAmount) || payoutAmount <= 0 || !Number.isSafeInteger(Math.round(payoutAmount * 1e7)) || Math.abs(payoutAmount * 1e7 - Math.round(payoutAmount * 1e7)) > 1e-7) {
    return reply({ ok: false, error: "PI_PAYOUT_MUST_BE_PROCESSING_WITH_VALID_CHAIN_PRECISION" }, 409)
  }

  const identityResponse = await fetch(`${base}/rest/v1/gh_pi_identities?${new URLSearchParams({ gh_user_id: `eq.${payout.seller_id}`, select: "pi_app_uid", limit: "1" })}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  })
  if (!identityResponse.ok) return reply({ ok: false, error: "RECIPIENT_IDENTITY_UNAVAILABLE" }, 503)
  const identities = await identityResponse.json() as Array<{ pi_app_uid: string }>
  const recipientUid = Array.isArray(identities) ? String(identities[0]?.pi_app_uid || "").trim() : ""
  if (!recipientUid) return reply({ ok: false, error: "VERIFIED_PI_RECIPIENT_REQUIRED" }, 409)

  const walletAuth = await assertPayoutWalletAuthorization({ ghUserId: payout.seller_id, recipientUid })
  if (!walletAuth.ok) {
    const err = String(walletAuth.error || "WALLET_AUTHORIZATION_REQUIRED")
    const status = err === "WALLET_AUTHORIZATION_UNAVAILABLE" ? 503 : 409
    return reply({ ok: false, error: err }, status)
  }

  const leaseToken = randomUUID()
  type BeginResult = { ok?: boolean; error?: string; executionId?: string; state?: string; paymentId?: string | null; txid?: string | null; recipientUid?: string; amount?: number; network?: string }
  const begin: BeginResult | null = await rpc<BeginResult>(base, key, "gh_pi_a2u_begin_execution", {
    p_request_id: requestId, p_lease_token: leaseToken, p_recipient_uid: recipientUid,
  }).catch((error): BeginResult => ({ ok: false, error: error instanceof Error ? error.message : "A2U_BEGIN_FAILED" }))
  if (!begin?.ok) {
    const error = String(begin?.error || "A2U_BEGIN_FAILED")
    const status = error === "PI_A2U_SEQUENCE_BUSY" ? 409 : error === "PAYOUT_NOT_FOUND" ? 404 : error.includes("HTTP_") ? 503 : 409
    return reply({ ok: false, error, retryable: error === "PI_A2U_SEQUENCE_BUSY" }, status)
  }

  let providerPaymentId = String(begin.paymentId || "")
  let txid = String(begin.txid || "")
  let leaseReleased = false
  async function update(state: "initiating" | "created" | "submitted" | "completed" | "attention", paymentId?: string, transactionId?: string, errorCode?: string) {
    const result = await rpc<{ ok?: boolean; error?: string }>(base, key, "gh_pi_a2u_update_execution", {
      p_request_id: requestId, p_lease_token: leaseToken, p_state: state,
      p_payment_id: paymentId || null, p_txid: transactionId || null, p_error_code: errorCode || null,
    })
    if (!result?.ok) throw new Error(String(result?.error || "A2U_EXECUTION_UPDATE_FAILED"))
  }
  async function release() {
    if (leaseReleased) return
    leaseReleased = true
    await rpc(base, key, "gh_pi_a2u_release_sequence_lease", { p_lease_token: leaseToken, p_request_id: requestId }).catch(() => null)
  }

  try {
    const PiBackendModule = await import("pi-backend")
    const PiNetwork = PiBackendModule.default
    const sdk = new PiNetwork(apiKey, walletSeed)
    let payment: PiBackendPayment
    if (!providerPaymentId) {
      // Recover a payment created just before a process crash. Never create a second payment
      // while any unrelated server-side A2U payment is incomplete: the SDK has one sequence lane.
      const incomplete = await sdk.getIncompleteServerPayments()
      const matched = findMatchingIncompleteA2u(incomplete, {
        requestId,
        recipientUid,
        amount: Number(payout.amount),
      })
      if (matched?.identifier) {
        providerPaymentId = matched.identifier
      } else if (incomplete.length > 0) {
        await enqueueA2uReview({
          sourceKind: "seller_marketplace",
          sourceRequestId: requestId,
          userId: payout.seller_id,
          reasonCode: "UNRELATED_INCOMPLETE_A2U_PAYMENT",
          detail: `incomplete_count=${incomplete.length}`,
        }).catch(() => null)
        return reply({ ok: false, error: "UNRELATED_INCOMPLETE_A2U_PAYMENT_REQUIRES_REVIEW", retryable: false, message: "An existing incomplete app-wallet payment must be reconciled before creating another A2U transaction." }, 409)
      } else {
        providerPaymentId = await sdk.createPayment({
          amount: Number(payout.amount),
          memo: `GreenHaven seller payout ${requestId}`.slice(0, 120),
          metadata: { provider: "greenhaven", direction: "a2u", payoutRequestId: requestId, executionId: begin.executionId },
          uid: recipientUid,
        })
      }
      if (!providerPaymentId || providerPaymentId.length > 200) {
        await update("attention", undefined, undefined, "INVALID_PROVIDER_PAYMENT_ID")
        return reply({ ok: false, error: "INVALID_PROVIDER_PAYMENT_ID", retryable: false }, 502)
      }
      await update("created", providerPaymentId)
    }

    payment = await sdk.getPayment(providerPaymentId)
    if (!providerMatches(payment, { paymentId: providerPaymentId, requestId, recipientUid, amount: Number(payout.amount) })) {
      await update("attention", providerPaymentId, undefined, "PROVIDER_PAYMENT_BINDING_MISMATCH")
      return reply({ ok: false, error: "PI_A2U_PROVIDER_PAYMENT_MISMATCH", retryable: false }, 409)
    }
    if (payment.transaction?.txid) {
      txid = String(payment.transaction.txid)
      if (!hasVerifiedTransaction(payment, txid)) {
        await update("attention", providerPaymentId, txid, "EXISTING_TRANSACTION_UNVERIFIED")
        return reply({ ok: false, error: "PI_A2U_EXISTING_TRANSACTION_UNVERIFIED", retryable: false }, 409)
      }
    } else if (!txid) {
      txid = await sdk.submitPayment(providerPaymentId)
    }
    if (!txid || txid.length > 300) {
      await update("attention", providerPaymentId, undefined, "INVALID_PROVIDER_TXID")
      return reply({ ok: false, error: "INVALID_PROVIDER_TXID", retryable: false }, 502)
    }
    await update("submitted", providerPaymentId, txid)

    const completed = await sdk.completePayment(providerPaymentId, txid)
    if (!providerMatches(completed, { paymentId: providerPaymentId, requestId, recipientUid, amount: Number(payout.amount), txid }) || completed.status?.developer_completed !== true) {
      await update("attention", providerPaymentId, txid, "PROVIDER_COMPLETION_UNVERIFIED")
      return reply({ ok: false, error: "PI_A2U_COMPLETION_UNVERIFIED", retryable: false, message: "Pi did not confirm a matching completed and verified Testnet transfer; payout is not marked paid." }, 409)
    }

    await update("completed", providerPaymentId, txid)
    const evidenceHash = createHash("sha256").update(JSON.stringify({ paymentId: providerPaymentId, txid, amount: completed.amount, recipientUid, network: completed.network, status: completed.status, metadata: completed.metadata })).digest("hex")
    const recorded = await rpc<{ ok?: boolean; error?: string; reconciliationId?: string }>(base, key, "gh_seller_payout_record_pi_confirmation", {
      p_request_id: requestId, p_provider_payment_id: providerPaymentId, p_txid: txid, p_currency: "PI",
      p_amount: Number(completed.amount), p_provider_status: "developer_completed", p_transaction_verified: true, p_evidence_hash: evidenceHash,
    })
    if (!recorded?.ok) return reply({ ok: false, error: recorded?.error || "PAYOUT_RECONCILIATION_FAILED", providerCompleted: true, payoutSettled: false, retryable: true }, 503)

    const transition = await rpc<{ ok?: boolean; error?: string; paid?: boolean; status?: string }>(base, key, "gh_seller_payout_transition", {
      p_request_id: requestId, p_next_status: "paid", p_operator_note: "Official pi-backend SDK A2U Testnet transaction verified and reconciled", p_payout_reference: providerPaymentId,
    })
    if (!transition?.ok || transition.paid !== true) {
      return reply({ ok: false, error: transition?.error || "PAYOUT_STATUS_UPDATE_FAILED", providerCompleted: true, reconciliationRecorded: true, payoutSettled: false, retryable: true }, 503)
    }
    return reply({ ok: true, requestId, executionId: begin.executionId, provider: "pi-backend", network: "Pi Testnet", providerPaymentId, txid, amount: Number(completed.amount), currency: "PI", status: "paid", paid: true, reconciliationId: recorded.reconciliationId })
  } catch (error) {
    // Do not set a terminal failure on ambiguous network errors: retry resumes from durable
    // providerPaymentId/txid or SDK incomplete-payment recovery without issuing a second payout.
    return reply({ ok: false, error: "PI_A2U_EXECUTION_INTERRUPTED", detail: error instanceof Error ? error.message.slice(0, 180) : "unknown", retryable: true, requestId, providerPaymentId: providerPaymentId || undefined, txid: txid || undefined }, 503)
  } finally {
    await release()
  }
}
