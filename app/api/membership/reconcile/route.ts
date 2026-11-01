/**
 * POST /api/membership/reconcile
 * Server-selected recovery for a paid membership whose entitlement write was
 * interrupted after payment completion. The caller supplies no payment data.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { reconcileMembershipFromPaymentHistory } from "@/lib/server/membership/entitlement-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
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
