/** Self-service: return payout reservations that never started execution back to Available. Funds only move back to the caller. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitStatus, durableRateLimitCode } from "@/lib/server/security/control-plane"
import { cancelUnstartedPayoutRequests } from "@/lib/server/earnings/unified-ledger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rate = await checkDurableRateLimit(`pi-earnings-cancel:${auth.userId}`, 5, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return reply({ ok: false, error: durableRateLimitCode(rate), retryAfterSec: rate.retryAfterSec }, durableRateLimitStatus(rate))
  const r = await cancelUnstartedPayoutRequests(auth.userId)
  if (!r.ok) return reply({ ok: false, error: r.error }, r.error === "EARNINGS_LEDGER_UNAVAILABLE" ? 503 : 409)
  return reply({ ok: true, released: r.released, releasedAtomic: r.releasedAtomic })
}
