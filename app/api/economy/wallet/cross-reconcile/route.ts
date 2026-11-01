/**
 * Phase 11 — Authenticated cross-feature wallet reconciliation (read-only).
 * Composes PI earnings, charity segregation, asset rails, and related endpoint map.
 * Does not write balances or invent financial outcomes.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { buildCrossFeatureReconcileReport } from "@/lib/server/economy/cross-feature-reconcile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  }
  const limit = checkRateLimit(`wallet-cross-reconcile:${auth.userId}`, 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
  }

  const report = await buildCrossFeatureReconcileReport({
    userId: auth.userId,
    requestHeaders: request.headers,
  })

  return NextResponse.json(
    {
      ok: true,
      report,
      readOnly: true,
      message:
        "Cross-feature reconciliation is informational. Use /api/payments/reconciliation for Pi intent↔order matching.",
    },
    { headers: noStore },
  )
}
