/** Authenticated Testnet-only cashback withdrawal. Amount and recipient are server-authoritative. */
import { createHash, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { resolvePiSandbox } from "@/lib/pi-env"
import type { PiBackendPayment } from "pi-backend"
import { assertPayoutWalletAuthorization } from "@/lib/server/identity/wallet-authorization"
import { postEarningsCredit, reserveEarningsForPayout, settleEarningsPayout, piToAtomic } from "@/lib/server/earnings/unified-ledger"
import { findMatchingIncompleteA2u, enqueueA2uReview } from "@/lib/server/payments/a2u-orchestration"
import { verifyA2uReceipt, publicReceiptView } from "@/lib/server/payments/a2u-receipt"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: noStore }) }
function amountMatches(expected: number, actual: unknown) {
  const value = typeof actual === "number" ? actual : typeof actual === "string" ? Number(actual) : NaN
  return Number.isFinite(value) && Math.abs(value - expected) < 1e-8
}
function providerMatches(payment: PiBackendPayment, input: { paymentId: string; requestId: string; recipientUid: string; amount: number; txid?: string }) {
  return payment.identifier === input.paymentId && payment.direction === "app_to_user" && payment.network === "Pi Testnet" &&
    payment.user_uid === input.recipientUid && amountMatches(input.amount, payment.amount) &&
    String(payment.metadata?.direction || "") === "a2u" && String(payment.metadata?.payoutRequestId || "") === input.requestId &&
    (!input.txid || (payment.transaction?.txid === input.txid && (payment.status?.transaction_verified === true || payment.transaction?.verified === true))) &&
    payment.status?.cancelled !== true && payment.status?.user_cancelled !== true
}
async function rpc<T>(base: string, key: string, name: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(12_000) })
  const result = await response.json().catch(() => null) as T | null
  if (!response.ok || result === null) throw new Error(`RPC_${name.toUpperCase()}_HTTP_${response.status}`)
  return result
}

type Begin = { ok?: boolean; error?: string; retryable?: boolean; alreadyPaid?: boolean; requestId?: string; status?: string; executionState?: string; providerPaymentId?: string | null; txid?: string | null; recipientUid?: string; amount?: number; amountAtomic?: string | number; network?: string }

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = checkRateLimit(`pi-cashback-claim:${auth.userId}`, 1, 30_000)
  if (!rate.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rate.retryAfterSec }, 429)

  // Fail closed: never permit a cashback claim on Mainnet through this Testnet release.
  if (process.env.PI_A2U_ENABLED !== "true" || process.env.PI_A2U_TESTNET_ONLY !== "true" || !resolvePiSandbox() || process.env.PI_ENV !== "production") {
    return reply({ ok: false, error: "PI_CASHBACK_A2U_TESTNET_DISABLED", message: "Cashback withdrawals are available only on an explicitly configured Pi Testnet deployment." }, 503)
  }
  const apiKey = String(process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()
  const walletSeed = String(process.env.PI_WALLET_PRIVATE_SEED || "").trim()
  if (!apiKey || !/^S[A-Z2-7]{55}$/.test(walletSeed)) return reply({ ok: false, error: "PI_A2U_SERVER_CREDENTIALS_MISSING" }, 503)

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "CASHBACK_SERVICE_UNAVAILABLE" }, 503)
  const base = env.supabaseUrl.replace(/\/$/, "")
  const key = env.supabaseServiceRoleKey
  try {
    const identityResponse = await fetch(`${base}/rest/v1/gh_pi_identities?${new URLSearchParams({ gh_user_id: `eq.${auth.userId}`, select: "pi_app_uid", limit: "1" })}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) })
    if (!identityResponse.ok) return reply({ ok: false, error: "RECIPIENT_IDENTITY_UNAVAILABLE" }, 503)
    const identityRows = await identityResponse.json() as Array<{ pi_app_uid?: string }>
    const recipientUid = String(identityRows[0]?.pi_app_uid || "").trim()
    if (!recipientUid) return reply({ ok: false, error: "VERIFIED_PI_RECIPIENT_REQUIRED", message: "Sign in with the Pi account linked to this GreenHaven account before withdrawing." }, 409)

    const walletAuth = await assertPayoutWalletAuthorization({ ghUserId: auth.userId, recipientUid })
    if (!walletAuth.ok) {
      const err = String(walletAuth.error || "WALLET_AUTHORIZATION_REQUIRED")
      const status = err === "WALLET_AUTHORIZATION_UNAVAILABLE" ? 503 : 409
      return reply({
        ok: false,
        error: err,
        message: err === "WALLET_AUTHORIZATION_REQUIRED"
          ? "Authorize Pi wallet payouts in Identity settings before withdrawing cashback."
          : undefined,
      }, status)
    }

    const leaseToken = randomUUID()
    const begin = await rpc<Begin>(base, key, "gh_pi_cashback_a2u_begin", { p_user_id: auth.userId, p_recipient_uid: recipientUid, p_lease_token: leaseToken })
    if (!begin.ok) {
      const error = String(begin.error || "CASHBACK_PAYOUT_BEGIN_FAILED")
      const status = error === "NO_WITHDRAWABLE_CASHBACK" ? 409 : error === "PI_A2U_SEQUENCE_BUSY" ? 409 : error.includes("HTTP_") ? 503 : 409
      return reply({ ok: false, error, retryable: begin.retryable === true }, status)
    }
    const requestId = String(begin.requestId || "")
    if (!/^cbp_[a-f0-9]{32}$/.test(requestId)) {
      await rpc(base, key, "gh_pi_a2u_release_sequence_lease", { p_lease_token: leaseToken, p_request_id: requestId }).catch(() => null)
      return reply({ ok: false, error: "INVALID_PAYOUT_REQUEST_ID" }, 503)
    }
    if (begin.alreadyPaid || begin.status === "paid") return reply({ ok: true, idempotent: true, requestId, status: "paid", paid: true, amount: Number(begin.amount), currency: "PI", network: "Pi Testnet", txid: begin.txid || undefined })
    const amount = Number(begin.amount)
    if (begin.network !== "Pi Testnet" || begin.recipientUid !== recipientUid || !Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 1e7 - Math.round(amount * 1e7)) > 1e-7) {
      await rpc(base, key, "gh_pi_a2u_release_sequence_lease", { p_lease_token: leaseToken, p_request_id: requestId }).catch(() => null)
      return reply({ ok: false, error: "CASHBACK_PAYOUT_BINDING_INVALID" }, 409)
    }

    // Phase 3: mirror cashback entitlement into unified earnings ledger (idempotent).
    const amountAtomic = Number(begin.amountAtomic)
    const atomic = Number.isFinite(amountAtomic) && amountAtomic > 0 ? Math.round(amountAtomic) : piToAtomic(amount)
    await postEarningsCredit({
      userId: auth.userId,
      amountAtomic: atomic,
      sourceKind: "cashback",
      uniqueRef: `cashback_credit:${requestId}`,
      status: "available",
      sourceTable: "gh_pi_cashback_a2u_payouts",
      sourceId: requestId,
      reason: "cashback_payout_begin",
    }).catch(() => null)
    await reserveEarningsForPayout({
      userId: auth.userId,
      amountAtomic: atomic,
      uniqueRef: `cashback_reserve:${requestId}`,
      payoutRequestId: requestId,
      reason: "cashback_a2u_reservation",
    }).catch(() => null)

    let providerPaymentId = String(begin.providerPaymentId || "")
    let txid = String(begin.txid || "")
    async function update(state: "initiating" | "created" | "submitted" | "completed" | "attention", paymentId?: string, transactionId?: string, errorCode?: string) {
      const updated = await rpc<{ ok?: boolean; error?: string }>(base, key, "gh_pi_cashback_a2u_update", { p_request_id: requestId, p_lease_token: leaseToken, p_state: state, p_payment_id: paymentId || null, p_txid: transactionId || null, p_error_code: errorCode || null })
      if (!updated.ok) throw new Error(updated.error || "CASHBACK_PAYOUT_UPDATE_FAILED")
    }
    try {
      const PiBackendModule = await import("pi-backend")
      const sdk = new PiBackendModule.default(apiKey, walletSeed)
      if (!providerPaymentId) {
        const incomplete = await sdk.getIncompleteServerPayments()
        const matched = findMatchingIncompleteA2u(incomplete, { requestId, recipientUid, amount })
        if (matched?.identifier) {
          providerPaymentId = matched.identifier
        } else if (incomplete.length > 0) {
          // Phase 7: durable attention + shared review queue (never create a second transfer)
          await update("attention", undefined, undefined, "UNRELATED_INCOMPLETE_A2U_PAYMENT")
          await enqueueA2uReview({
            sourceKind: "cashback",
            sourceRequestId: requestId,
            userId: auth.userId,
            reasonCode: "UNRELATED_INCOMPLETE_A2U_PAYMENT",
            amountAtomic: atomic,
            detail: `incomplete_count=${incomplete.length}`,
          }).catch(() => null)
          return reply({
            ok: false,
            error: "UNRELATED_INCOMPLETE_A2U_PAYMENT_REQUIRES_REVIEW",
            retryable: false,
            requestId,
            message: "An incomplete Pi A2U payment from another request is blocking new payouts. Operator review is required.",
          }, 409)
        } else {
          providerPaymentId = await sdk.createPayment({
            amount,
            memo: `GreenHaven cashback ${requestId}`.slice(0, 120),
            metadata: {
              provider: "greenhaven",
              direction: "a2u",
              payoutRequestId: requestId,
              payoutKind: "pi_cashback",
            },
            uid: recipientUid,
          })
        }
        if (!providerPaymentId || providerPaymentId.length > 200) { await update("attention", undefined, undefined, "INVALID_PROVIDER_PAYMENT_ID"); return reply({ ok: false, error: "INVALID_PROVIDER_PAYMENT_ID" }, 502) }
        await update("created", providerPaymentId)
      }
      let payment = await sdk.getPayment(providerPaymentId)
      if (!providerMatches(payment, { paymentId: providerPaymentId, requestId, recipientUid, amount })) {
        await update("attention", providerPaymentId, undefined, "PROVIDER_PAYMENT_BINDING_MISMATCH")
        return reply({ ok: false, error: "PI_CASHBACK_PROVIDER_PAYMENT_MISMATCH", retryable: false }, 409)
      }
      if (payment.transaction?.txid) {
        txid = String(payment.transaction.txid)
        if (!providerMatches(payment, { paymentId: providerPaymentId, requestId, recipientUid, amount, txid })) {
          await update("attention", providerPaymentId, txid, "EXISTING_TRANSACTION_UNVERIFIED")
          return reply({ ok: false, error: "PI_CASHBACK_TRANSACTION_UNVERIFIED" }, 409)
        }
      } else if (!txid) txid = await sdk.submitPayment(providerPaymentId)
      if (!txid || txid.length > 300) { await update("attention", providerPaymentId, undefined, "INVALID_PROVIDER_TXID"); return reply({ ok: false, error: "INVALID_PROVIDER_TXID" }, 502) }
      if (payment.status?.developer_completed !== true) {
        await update("submitted", providerPaymentId, txid)
        payment = await sdk.completePayment(providerPaymentId, txid)
      }
      if (!providerMatches(payment, { paymentId: providerPaymentId, requestId, recipientUid, amount, txid }) || payment.status?.developer_completed !== true) {
        await update("attention", providerPaymentId, txid, "PROVIDER_COMPLETION_UNVERIFIED")
        return reply({ ok: false, error: "PI_CASHBACK_COMPLETION_UNVERIFIED", payoutSettled: false }, 409)
      }
      await update("completed", providerPaymentId, txid)
      const evidenceHash = createHash("sha256").update(JSON.stringify({ paymentId: providerPaymentId, txid, amount: payment.amount, recipientUid, network: payment.network, status: payment.status, metadata: payment.metadata })).digest("hex")
      const settled = await rpc<{ ok?: boolean; error?: string; paid?: boolean; duplicate?: boolean }>(base, key, "gh_pi_cashback_a2u_settle", { p_request_id: requestId, p_payment_id: providerPaymentId, p_txid: txid, p_evidence_hash: evidenceHash })
      if (!settled.ok || settled.paid !== true) return reply({ ok: false, error: settled.error || "CASHBACK_PAYOUT_RECONCILIATION_FAILED", providerCompleted: true, payoutSettled: false, retryable: true, requestId, providerPaymentId, txid }, 503)
      await settleEarningsPayout({
        userId: auth.userId,
        amountAtomic: atomic,
        uniqueRef: `cashback_settle:${requestId}`,
        payoutRequestId: requestId,
        reason: "cashback_a2u_settled",
      }).catch(() => null)
      const receipt = verifyA2uReceipt({
        requestId,
        recipientUid,
        amount,
        providerPaymentId,
        txid,
        payment,
        durableStatus: "paid",
        network: "Pi Testnet",
      })
      if (!receipt.ok) {
        return reply({
          ok: false,
          error: "RECEIPT_VERIFICATION_FAILED",
          detail: receipt.error,
          providerCompleted: true,
          payoutSettled: true,
          requestId,
          providerPaymentId,
          txid,
        }, 502)
      }
      return reply({
        ok: true,
        requestId,
        provider: "pi-backend",
        network: "Pi Testnet",
        providerPaymentId,
        txid,
        amount,
        currency: "PI",
        status: "paid",
        paid: true,
        idempotent: settled.duplicate === true,
        receipt: publicReceiptView(receipt.receipt),
      })
    } catch (error) {
      return reply({ ok: false, error: "PI_CASHBACK_PAYOUT_INTERRUPTED", retryable: true, requestId, providerPaymentId: providerPaymentId || undefined, txid: txid || undefined, detail: error instanceof Error ? error.message.slice(0, 160) : "unknown" }, 503)
    } finally {
      await rpc(base, key, "gh_pi_a2u_release_sequence_lease", { p_lease_token: leaseToken, p_request_id: requestId }).catch(() => null)
    }
  } catch (error) {
    return reply({ ok: false, error: "CASHBACK_PAYOUT_UNAVAILABLE", retryable: true, detail: error instanceof Error ? error.message.slice(0, 120) : "unknown" }, 503)
  }
}
