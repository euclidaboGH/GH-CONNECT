/** Requests a transfer only against a separately recorded, verified NGN funding obligation. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { paystackTransfersEnabled } from "@/lib/server/payouts/paystack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const stepUp = await requireRecentStepUp(auth)
  if (stepUp) return reply({ ok: false, error: stepUp.code, message: stepUp.message }, stepUp.status)
  const rl = checkRateLimit(`payout-bank-request:${auth.userId}`, 3, 60 * 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  if (process.env.PAYSTACK_TRANSFERS_ENABLED !== "true" || !paystackTransfersEnabled()) return reply({ ok: false, error: "BANK_PAYOUT_PROVIDER_DISABLED" }, 503)
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const obligationId = String(body?.obligationId || "").trim()
  const beneficiaryId = String(body?.beneficiaryId || "").trim()
  const idempotencyKey = String(request.headers.get("Idempotency-Key") || body?.idempotencyKey || "").trim()
  if (!/^gbo_[a-f0-9]{32}$/i.test(obligationId) || !/^gbn_[a-f0-9]{32}$/i.test(beneficiaryId) || idempotencyKey.length < 8 || idempotencyKey.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) return reply({ ok: false, error: "INVALID_INPUT" }, 400)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_bank_payout_request`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_seller_id: auth.userId, p_obligation_id: obligationId, p_beneficiary_id: beneficiaryId, p_idempotency_key: idempotencyKey }),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || result?.ok !== true) {
      const error = String(result?.error || "BANK_PAYOUT_REQUEST_FAILED")
      return reply({ ok: false, error }, error === "OBLIGATION_NOT_FOUND" ? 404 : error === "BENEFICIARY_NOT_VERIFIED" || error === "OBLIGATION_NOT_AVAILABLE" || error === "OBLIGATION_OWNER_MISMATCH" ? 409 : 503)
    }
    return reply({ ok: true, requestId: result.requestId, status: result.status, amountKobo: result.amountKobo, currency: "NGN", duplicate: Boolean(result.duplicate), paid: false, message: "Bank payout request recorded. It must be approved and provider-confirmed before being marked paid." }, 202)
  } catch { return reply({ ok: false, error: "BANK_PAYOUT_SERVICE_UNAVAILABLE", retryable: true }, 503) }
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rl = checkRateLimit(`payout-bank-history:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  const query = new URLSearchParams({ seller_id: `eq.${auth.userId}`, select: "id,amount_kobo,currency,status,provider_status,created_at,updated_at,paid_at", order: "created_at.desc", limit: "100" })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_bank_payout_requests?${query}`, { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }, cache: "no-store", signal: AbortSignal.timeout(12_000) })
    if (!response.ok) return reply({ ok: false, error: "BANK_PAYOUT_HISTORY_UNAVAILABLE" }, 503)
    const requests = await response.json()
    return Array.isArray(requests) ? reply({ ok: true, requests }) : reply({ ok: false, error: "BANK_PAYOUT_HISTORY_INVALID" }, 503)
  } catch { return reply({ ok: false, error: "BANK_PAYOUT_HISTORY_UNAVAILABLE" }, 503) }
}
