/** Privileged provider lookup for recovering missed webhooks; this route never trusts client-supplied status. */
import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { fetchNgnTransfer, paystackLiveTransfersApproved, paystackTransfersEnabled, PaystackError } from "@/lib/server/payouts/paystack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
function authorized(request: Request): boolean {
  const expected = Buffer.from(String(process.env.GHC_PAYOUT_RECONCILIATION_KEY || ""), "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-payout-reconciliation-key") || ""), "utf8")
  return expected.length > 0 && expected.length === supplied.length && timingSafeEqual(expected, supplied)
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const rl = checkRateLimit("paystack-bank-payout-reconcile", 10, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  if (!paystackTransfersEnabled()) return reply({ ok: false, error: "BANK_PAYOUT_PROVIDER_DISABLED" }, 503)
  if (!paystackLiveTransfersApproved()) return reply({ ok: false, error: "LIVE_BANK_TRANSFERS_NOT_APPROVED" }, 503)
  const { requestId } = await context.params
  if (!/^gbp_[a-f0-9]{32}$/i.test(requestId)) return reply({ ok: false, error: "INVALID_REQUEST_ID" }, 400)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  const base = env.supabaseUrl.replace(/\/$/, "")
  try {
    const query = new URLSearchParams({ id: `eq.${requestId}`, select: "id,status,provider_reference,amount_kobo,provider_transfer_id", limit: "1" })
    const lookup = await fetch(`${base}/rest/v1/gh_bank_payout_requests?${query}`, { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store", signal: AbortSignal.timeout(12_000) })
    if (!lookup.ok) return reply({ ok: false, error: "PAYOUT_RECONCILIATION_CONTEXT_FAILED" }, 503)
    const rows = await lookup.json() as Array<Record<string, unknown>>
    const payout = Array.isArray(rows) ? rows[0] : undefined
    if (!payout) return reply({ ok: false, error: "PAYOUT_NOT_FOUND" }, 404)
    if (!new Set(["processing", "pending", "paid", "failed", "reversed"]).has(String(payout.status))) return reply({ ok: false, error: "PAYOUT_NOT_IN_FLIGHT" }, 409)
    const reference = String(payout.provider_reference || "")
    const amountKobo = Number(payout.amount_kobo)
    if (!/^ghb_[a-f0-9]{32}$/.test(reference) || !Number.isSafeInteger(amountKobo)) return reply({ ok: false, error: "PAYOUT_PROVIDER_BINDING_INVALID" }, 409)
    const transfer = await fetchNgnTransfer(reference)
    if (transfer.reference !== reference || transfer.amount !== amountKobo || transfer.currency !== "NGN" || !transfer.id) return reply({ ok: false, error: "PAYSTACK_RECONCILIATION_BINDING_MISMATCH", manualReviewRequired: true }, 409)
    const status = String(transfer.status || "").toLowerCase()
    if (!new Set(["success", "failed", "reversed"]).has(status)) return reply({ ok: true, requestId, status: payout.status || "pending", providerStatus: status || "unknown", paid: false, retryable: true, message: "Provider transfer is not in a terminal state; continue reconciliation with the same reference." }, 202)
    const evidenceHash = createHash("sha256").update(JSON.stringify({ reference: transfer.reference, id: transfer.id, amount: transfer.amount, currency: transfer.currency, status: transfer.status, transferCode: transfer.transfer_code || null })).digest("hex")
    const applyResponse = await fetch(`${base}/rest/v1/rpc/gh_bank_payout_apply_reconciliation`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_request_id: requestId, p_provider_reference: reference, p_provider_transfer_id: String(transfer.id), p_transfer_code: String(transfer.transfer_code || ""), p_amount_kobo: transfer.amount, p_currency: transfer.currency, p_provider_status: status, p_evidence_hash: evidenceHash }),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    const applied = await applyResponse.json().catch(() => null) as Record<string, unknown> | null
    if (!applyResponse.ok || applied?.ok !== true) return reply({ ok: false, error: String(applied?.error || "PAYOUT_RECONCILIATION_FAILED"), retryable: true }, 503)
    return reply({ ok: true, requestId, status: applied.status, providerStatus: status, duplicate: Boolean(applied.duplicate), paid: applied.paid === true })
  } catch (error) {
    const e = error instanceof PaystackError ? error : null
    return reply({ ok: false, error: e?.code || "BANK_PAYOUT_RECONCILIATION_UNAVAILABLE", retryable: e?.retryable !== false }, 503)
  }
}
