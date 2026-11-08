/**
 * POST /api/membership/reconcile
 * Server-selected recovery for a paid membership whose entitlement write was
 * interrupted after payment completion. The caller supplies no payment data.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { reconcileMembershipFromPaymentHistory } from "@/lib/server/membership/entitlement-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rateLimit = await checkDurableRateLimit(`membership-reconcile:${auth.userId}`, 10, 60_000, { onUnavailable: "deny" })
  if (!rateLimit.ok) {
    return NextResponse.json({ ok: false, error: durableRateLimitCode(rateLimit) }, {
      status: durableRateLimitStatus(rateLimit),
      headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" },
    })
  }
  const result = await reconcileMembershipFromPaymentHistory(auth.userId)
  if (!result.ok) {
    return NextResponse.json(result, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({
    ok: true,
    recovered: result.recovered,
    entitlement: result.entitlement,
    intentId: result.intentId || null,
    source: result.recovered ? "payment_reconciliation" : "authoritative_membership",
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } })
}
