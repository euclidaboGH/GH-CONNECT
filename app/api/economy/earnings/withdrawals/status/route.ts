/** User-scoped, read-only status for durable PI earnings payout requests. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" }
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }) }

type PayoutRow = {
  id: string
  gross_atomic: string | number
  fee_atomic: string | number
  net_atomic: string | number
  network: string
  status: string
  provider_txid: string | null
  failure_code: string | null
  created_at: string
  updated_at: string
  settled_at: string | null
}

async function handleGet(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = await checkDurableRateLimit(`pi-earnings-payout-status:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return reply({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, durableRateLimitStatus(rate))

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_STATUS_UNAVAILABLE" }, 503)
  const base = env.supabaseUrl.replace(/\/$/, "")
  const params = new URLSearchParams({
    select: "id,gross_atomic,fee_atomic,net_atomic,network,status,provider_txid,failure_code,created_at,updated_at,settled_at",
    user_id: `eq.${auth.userId}`,
    order: "created_at.desc",
    limit: "10",
  })
  try {
    const response = await fetch(`${base}/rest/v1/gh_pi_earnings_payout_requests?${params}`, {
      method: "GET",
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return reply({ ok: false, error: "PAYOUT_STATUS_UNAVAILABLE" }, 503)
    const rows = await response.json().catch(() => null) as PayoutRow[] | null
    if (!Array.isArray(rows)) return reply({ ok: false, error: "PAYOUT_STATUS_UNAVAILABLE" }, 503)
    const items = rows.filter((row) => row && typeof row.id === "string").map((row) => ({
      requestId: row.id,
      grossAtomic: String(row.gross_atomic),
      feeAtomic: String(row.fee_atomic),
      netAtomic: String(row.net_atomic),
      network: row.network,
      status: row.status,
      transactionId: row.status === "paid" && typeof row.provider_txid === "string" ? row.provider_txid : null,
      // Do not expose internal worker/provider error detail; expose a stable code for support.
      failureCode: row.status === "failed" || row.status === "uncertain" ? (/^[A-Z0-9_]{1,80}$/.test(String(row.failure_code || "")) ? row.failure_code : "PAYOUT_REQUIRES_REVIEW") : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      settledAt: row.status === "paid" ? row.settled_at : null,
    }))
    return reply({ ok: true, items })
  } catch {
    return reply({ ok: false, error: "PAYOUT_STATUS_UNAVAILABLE" }, 503)
  }
}
export async function GET(request: Request) {
  try { return await handleGet(request) }
  catch (error) {
    console.error("[pi-earnings] payout status endpoint failed safely", { error: error instanceof Error ? error.name : "UNKNOWN_ERROR" })
    return reply({ ok: false, error: "PAYOUT_STATUS_UNAVAILABLE", message: "Withdrawal status is temporarily unavailable. Your existing request has not been cancelled." }, 503)
  }
}
