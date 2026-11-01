/** Privileged GHC seller payout settlement. Only a configured, funded treasury can pay. */
import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } })
}
function authorized(request: Request): boolean {
  const expected = Buffer.from(String(process.env.GHC_PAYOUT_RECONCILIATION_KEY || ""), "utf8")
  const supplied = Buffer.from(String(request.headers.get("x-ghc-payout-reconciliation-key") || ""), "utf8")
  return expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  if (process.env.GHC_MARKETPLACE_GHC_PAYOUTS_ENABLED !== "true") return reply({ ok: false, error: "GHC_PAYOUT_RAIL_DISABLED" }, 503)
  const treasuryUserId = String(process.env.GHC_MARKETPLACE_PAYOUT_TREASURY_USER_ID || "").trim()
  if (!treasuryUserId) return reply({ ok: false, error: "GHC_PAYOUT_TREASURY_NOT_CONFIGURED" }, 503)
  const rl = checkRateLimit("ghc-seller-payout-settlement", 10, 60_000)
  if (!rl.ok) return reply({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, 429)
  const { requestId } = await context.params
  if (!/^spr_[a-f0-9]{16,40}$/i.test(requestId)) return reply({ ok: false, error: "INVALID_REQUEST_ID" }, 400)
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_seller_payout_settle_ghc_atomic`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({ p_request_id: requestId, p_treasury_user_id: treasuryUserId }),
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result || result.ok !== true) {
      const error = String(result?.error || "GHC_PAYOUT_SETTLEMENT_FAILED")
      const status = error === "PAYOUT_NOT_FOUND" ? 404 : error === "PAYOUT_NOT_PROCESSING" || error === "INSUFFICIENT_FUNDED_TREASURY" || error === "PAYOUT_ORDER_BACKING_INVALID" ? 409 : 503
      return reply({ ok: false, error, available: result?.available, required: result?.required, retryable: error === "INSUFFICIENT_FUNDED_TREASURY" }, status)
    }
    return reply({ ok: true, provider: "ghc_internal_ledger", ...result })
  } catch {
    return reply({ ok: false, error: "GHC_PAYOUT_SETTLEMENT_UNAVAILABLE", retryable: true }, 503)
  }
}
