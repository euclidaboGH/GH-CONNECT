/** Privileged recovery-only completion for an already submitted, durably linked Pi A2U payout. */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { resolvePiSandbox } from "@/lib/pi-env"
import type { PiBackendPayment } from "pi-backend"

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
function verified(payment: PiBackendPayment, input: { paymentId: string; requestId: string; recipientUid: string; amount: number; txid: string }) {
  const amount = typeof payment.amount === "number" ? payment.amount : Number(payment.amount)
  return payment.identifier === input.paymentId && payment.direction === "app_to_user" && payment.network === "Pi Testnet" &&
    payment.user_uid === input.recipientUid && Number.isFinite(amount) && Math.abs(amount - input.amount) < 1e-8 &&
    String(payment.metadata?.payoutRequestId || "") === input.requestId && String(payment.metadata?.direction || "") === "a2u" &&
    payment.transaction?.txid === input.txid && (payment.status?.transaction_verified === true || payment.transaction?.verified === true) &&
    payment.status?.cancelled !== true && payment.status?.user_cancelled !== true
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rl = checkRateLimit("a2u-complete-privileged", 10, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  if (process.env.PI_A2U_ENABLED !== "true" || process.env.PI_A2U_TESTNET_ONLY !== "true" || !resolvePiSandbox() || process.env.PI_ENV !== "production") {
    return reply({ ok: false, error: "PI_A2U_DISABLED" }, 503)
  }
  const apiKey = String(process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()
  const walletSeed = String(process.env.PI_WALLET_PRIVATE_SEED || "").trim()
  if (!apiKey || !/^S[A-Z2-7]{55}$/.test(walletSeed)) return reply({ ok: false, error: "PI_A2U_SERVER_CREDENTIALS_MISSING" }, 503)

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || Array.isArray(body)) return reply({ ok: false, error: "INVALID_BODY" }, 400)
  const paymentId = String(body.paymentId || "").trim()
  const txid = String(body.txid || "").trim()
  const requestId = String(body.payoutRequestId || "").trim()
  if (!paymentId || paymentId.length > 200 || !txid || txid.length > 300 || !/^spr_[a-f0-9]{16,40}$/i.test(requestId)) {
    return reply({ ok: false, error: "PAYMENT_ID_TXID_AND_PAYOUT_REQUEST_REQUIRED" }, 400)
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  const base = env.supabaseUrl.replace(/\/$/, "")
  const key = env.supabaseServiceRoleKey
  try {
    const headers = { apikey: key, Authorization: `Bearer ${key}` }
    const payoutResponse = await fetch(`${base}/rest/v1/gh_seller_payout_requests?${new URLSearchParams({ id: `eq.${requestId}`, select: "id,seller_id,currency,amount,status", limit: "1" })}`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) })
    if (!payoutResponse.ok) return reply({ ok: false, error: "PAYOUT_LOOKUP_UNAVAILABLE" }, 503)
    const payoutRows = await payoutResponse.json() as Array<{ id: string; seller_id: string; currency: string; amount: number; status: string }>
    const payout = Array.isArray(payoutRows) ? payoutRows[0] : undefined
    if (!payout) return reply({ ok: false, error: "PAYOUT_NOT_FOUND" }, 404)
    if (payout.currency !== "PI" || !["processing", "paid"].includes(payout.status)) return reply({ ok: false, error: "PI_PAYOUT_NOT_PROCESSING" }, 409)

    const executionResponse = await fetch(`${base}/rest/v1/gh_pi_a2u_executions?${new URLSearchParams({ payout_request_id: `eq.${requestId}`, provider_payment_id: `eq.${paymentId}`, select: "state,txid,recipient_uid,amount,network", limit: "1" })}`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) })
    if (!executionResponse.ok) return reply({ ok: false, error: "A2U_EXECUTION_LOOKUP_UNAVAILABLE" }, 503)
    const executions = await executionResponse.json() as Array<{ state: string; txid: string | null; recipient_uid: string; amount: number; network: string }>
    const execution = Array.isArray(executions) ? executions[0] : undefined
    if (!execution || !["created", "submitted", "completed"].includes(execution.state) || execution.network !== "Pi Testnet" || Number(execution.amount) !== Number(payout.amount) || (execution.txid && execution.txid !== txid)) {
      return reply({ ok: false, error: "DURABLE_A2U_EXECUTION_BINDING_REQUIRED" }, 409)
    }

    const identityResponse = await fetch(`${base}/rest/v1/gh_pi_identities?${new URLSearchParams({ gh_user_id: `eq.${payout.seller_id}`, select: "pi_app_uid", limit: "1" })}`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) })
    if (!identityResponse.ok) return reply({ ok: false, error: "RECIPIENT_IDENTITY_UNAVAILABLE" }, 503)
    const identities = await identityResponse.json() as Array<{ pi_app_uid: string }>
    const recipientUid = Array.isArray(identities) ? String(identities[0]?.pi_app_uid || "").trim() : ""
    if (!recipientUid || recipientUid !== execution.recipient_uid) return reply({ ok: false, error: "VERIFIED_PI_RECIPIENT_REQUIRED" }, 409)

    const PiBackendModule = await import("pi-backend")
    const sdk = new PiBackendModule.default(apiKey, walletSeed)
    const before = await sdk.getPayment(paymentId)
    if (!verified(before, { paymentId, requestId, recipientUid, amount: Number(payout.amount), txid })) {
      return reply({ ok: false, error: "PI_A2U_TRANSACTION_NOT_VERIFIED" }, 409)
    }
    if (before.status?.developer_completed === true) {
      return reply({ ok: true, idempotent: true, paymentId, txid, requestId, provider: "pi-backend", network: "Pi Testnet", providerCompleted: true, payoutSettled: false })
    }
    const completed = await sdk.completePayment(paymentId, txid)
    if (!verified(completed, { paymentId, requestId, recipientUid, amount: Number(payout.amount), txid }) || completed.status?.developer_completed !== true) {
      return reply({ ok: false, error: "PI_A2U_COMPLETION_UNVERIFIED", providerCompleted: false, payoutSettled: false }, 409)
    }
    return reply({ ok: true, idempotent: false, paymentId, txid, requestId, provider: "pi-backend", network: "Pi Testnet", providerCompleted: true, payoutSettled: false, message: "Provider completion is verified; rerun the durable payout reconciliation workflow to settle the seller request." })
  } catch (error) {
    return reply({ ok: false, error: "PI_A2U_COMPLETION_UNAVAILABLE", retryable: true, detail: error instanceof Error ? error.message.slice(0, 160) : "unknown" }, 503)
  }
}
