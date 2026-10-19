/** Seller payout workflow intake. This creates a review request; it never initiates an external transfer. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" } })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const stepUp = await requireRecentStepUp(auth)
  if (stepUp) return reply({ ok: false, error: stepUp.code, message: stepUp.message }, stepUp.status)
  const rl = checkRateLimit(`seller-payout:${auth.userId}`, 3, 60 * 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const currency = String(body.currency || "").toUpperCase()
  const amount = Number(body.amount)
  const idempotencyKey = String(request.headers.get("Idempotency-Key") || body.idempotencyKey || "").trim()
  if (["BANK", "NGN", "USD", "EUR"].includes(currency)) {
    return reply({ ok: false, error: "UNSUPPORTED_PAYOUT_RAIL", message: "Bank and fiat payouts remain unavailable until a verified banking adapter and reconciliation workflow are implemented." }, 409)
  }
  if (!["GHC", "PI"].includes(currency) || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || idempotencyKey.length < 8 || idempotencyKey.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
    return reply({ ok: false, error: "INVALID_INPUT" }, 400)
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_seller_payout_request`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_seller_id: auth.userId, p_currency: currency, p_amount: amount, p_idempotency_key: idempotencyKey }), cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) {
      const error = String(result?.error || "PAYOUT_REQUEST_UNAVAILABLE")
      const status = error === "INVALID_INPUT" ? 400 : error === "NO_ELIGIBLE_COMPLETED_ORDERS" || error === "AMOUNT_MUST_MATCH_ELIGIBLE_BALANCE" ? 409 : 503
      return reply({ ok: false, error, eligibleAmount: result?.eligibleAmount, currency: result?.currency }, status)
    }
    return reply({ ok: true, requestId: result.requestId, status: result.status, amount: result.amount, currency: result.currency, allocatedOrders: result.allocatedOrders, duplicate: Boolean(result.duplicate), paid: false, message: "Payout request recorded for review. No funds have been transferred." }, 202)
  } catch {
    return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  }
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rl = checkRateLimit(`seller-payout-list:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  try {
    const query = new URLSearchParams({ seller_id: `eq.${auth.userId}`, select: "id,currency,amount,status,created_at,updated_at,paid_at", order: "created_at.desc", limit: "100" })
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_seller_payout_requests?${query}`, { headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, Accept: "application/json" }, cache: "no-store" })
    if (!response.ok) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
    const requests = await response.json()
    if (!Array.isArray(requests)) return reply({ ok: false, error: "PAYOUT_RESPONSE_INVALID" }, 503)
    return reply({ ok: true, requests })
  } catch { return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503) }
}
