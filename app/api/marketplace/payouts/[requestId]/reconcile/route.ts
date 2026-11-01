/**
 * Privileged PI payout reconciliation. A request can become paid only after a Pi provider
 * lookup confirms the exact amount, recipient, completed status and verified transaction.
 * This adapter intentionally does not reconcile GHC or bank transfers.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { piGetPayment, amountsMatch } from "@/lib/server/payments/pi-api"
import { resolvePiSandbox } from "@/lib/pi-env"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const configuredKey = String(process.env.GHC_PAYOUT_RECONCILIATION_KEY || "").trim()
  const suppliedKey = String(request.headers.get("x-ghc-payout-reconciliation-key") || "").trim()
  const configuredBytes = Buffer.from(configuredKey, "utf8")
  const suppliedBytes = Buffer.from(suppliedKey, "utf8")
  if (!configuredKey || suppliedBytes.length !== configuredBytes.length || !timingSafeEqual(suppliedBytes, configuredBytes)) {
    return reply({ ok: false, error: "FORBIDDEN" }, 403)
  }
  const rl = checkRateLimit("payout-reconciliation-privileged", 20, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)

  const { requestId } = await context.params
  if (!/^spr_[a-f0-9]{16,40}$/i.test(requestId)) return reply({ ok: false, error: "INVALID_REQUEST_ID" }, 400)
  const parsedBody = await readBoundedJson(request, 64 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
  const body = parsedBody.value as Record<string, unknown>
  const paymentId = String(body.providerPaymentId || "").trim()
  if (!paymentId || paymentId.length > 200) return reply({ ok: false, error: "PROVIDER_PAYMENT_ID_REQUIRED" }, 400)

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  const base = env.supabaseUrl.replace(/\/$/, "")
  try {
    const payoutParams = new URLSearchParams({ id: `eq.${requestId}`, select: "id,seller_id,currency,amount,status,payout_reference", limit: "1" })
    const payoutResponse = await fetch(`${base}/rest/v1/gh_seller_payout_requests?${payoutParams}`, {
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store",
    })
    if (!payoutResponse.ok) return reply({ ok: false, error: "PAYOUT_LOOKUP_UNAVAILABLE" }, 503)
    const payoutRows = await payoutResponse.json() as Array<{ id: string; seller_id: string; currency: string; amount: number; status: string }>
    const payout = Array.isArray(payoutRows) ? payoutRows[0] : undefined
    if (!payout) return reply({ ok: false, error: "PAYOUT_NOT_FOUND" }, 404)
    if (payout.status === "paid") return reply({ ok: true, idempotent: true, requestId, status: "paid", paid: true })
    if (payout.status !== "processing") return reply({ ok: false, error: "PAYOUT_NOT_PROCESSING" }, 409)
    if (payout.currency !== "PI") return reply({ ok: false, error: "UNSUPPORTED_PAYOUT_RAIL", message: "Only PI payouts are reconciled by this adapter. GHC and bank payouts remain pending." }, 409)

    const identityParams = new URLSearchParams({ gh_user_id: `eq.${payout.seller_id}`, select: "pi_app_uid", limit: "1" })
    const identityResponse = await fetch(`${base}/rest/v1/gh_pi_identities?${identityParams}`, {
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store",
    })
    if (!identityResponse.ok) return reply({ ok: false, error: "RECIPIENT_IDENTITY_UNAVAILABLE" }, 503)
    const identities = await identityResponse.json() as Array<{ pi_app_uid: string }>
    const identity = Array.isArray(identities) ? identities[0] : undefined
    if (!identity?.pi_app_uid) return reply({ ok: false, error: "VERIFIED_PI_RECIPIENT_REQUIRED" }, 409)

    const provider = await piGetPayment(paymentId)
    const payment = provider.payment
    const txid = String(payment?.transaction?.txid || "").trim()
    // Provider fields are authoritative: never infer the recipient or direction from metadata.
    const recipientUid = String(payment?.user_uid || "").trim()
    const expectedNetwork = resolvePiSandbox() ? "Pi Testnet" : "Pi Network"
    const verified = provider.ok && !!payment && payment.identifier === paymentId &&
      payment.direction === "app_to_user" && payment.network === expectedNetwork &&
      payment.status?.developer_completed === true &&
      (payment.status?.transaction_verified === true || payment.transaction?.verified === true) &&
      !!txid && recipientUid === identity.pi_app_uid &&
      String(payment.metadata?.payoutRequestId || "") === requestId &&
      String(payment.metadata?.direction || "") === "a2u" &&
      amountsMatch(Number(payout.amount), payment.amount)
    if (!verified || !payment) return reply({ ok: false, error: "PI_PAYOUT_NOT_VERIFIED", message: "Provider evidence did not match recipient, request, amount, A2U direction, configured network, completed status and verified transaction." }, 409)

    const evidenceHash = createHash("sha256").update(JSON.stringify({ paymentId, txid, amount: payment.amount, recipientUid, status: payment.status, metadata: payment.metadata })).digest("hex")
    const recordResponse = await fetch(`${base}/rest/v1/rpc/gh_seller_payout_record_pi_confirmation`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_request_id: requestId, p_provider_payment_id: paymentId, p_txid: txid, p_currency: "PI", p_amount: Number(payment.amount), p_provider_status: "developer_completed", p_transaction_verified: true, p_evidence_hash: evidenceHash }), cache: "no-store",
    })
    const recorded = await recordResponse.json().catch(() => null) as { ok?: boolean; error?: string; reconciliationId?: string } | null
    if (!recordResponse.ok || recorded?.ok !== true) return reply({ ok: false, error: recorded?.error || "PAYOUT_RECONCILIATION_FAILED" }, 503)

    const transitionResponse = await fetch(`${base}/rest/v1/rpc/gh_seller_payout_transition`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_request_id: requestId, p_next_status: "paid", p_operator_note: "Pi provider status and recipient/amount/transaction verified by reconciliation adapter", p_payout_reference: paymentId }), cache: "no-store",
    })
    const transition = await transitionResponse.json().catch(() => null) as { ok?: boolean; error?: string; status?: string; paid?: boolean } | null
    if (!transitionResponse.ok || transition?.ok !== true || transition.paid !== true) {
      return reply({ ok: false, error: transition?.error || "PAYOUT_STATUS_UPDATE_FAILED", reconciliationRecorded: true, retryable: true }, 503)
    }
    return reply({ ok: true, requestId, reconciliationId: recorded.reconciliationId, status: "paid", paid: true, provider: "pi_a2u", amount: Number(payment.amount), currency: "PI", txid })
  } catch {
    return reply({ ok: false, error: "PAYOUT_RECONCILIATION_UNAVAILABLE", retryable: true }, 503)
  }
}
