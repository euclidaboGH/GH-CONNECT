/**
 * Phase 6 — Authoritative withdrawable PI earnings balance.
 * GET only. Never accepts client-supplied balances or amounts to mutate.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { getWithdrawableBalance } from "@/lib/server/earnings/unified-ledger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  }
  const limit = checkRateLimit(`earnings-withdrawable:${auth.userId}`, 60, 60_000)
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
  }
  const snapshot = await getWithdrawableBalance(auth.userId)
  if (!snapshot.ok) {
    const status = snapshot.error === "EARNINGS_LEDGER_UNAVAILABLE" ? 503 : 409
    return NextResponse.json({ ok: false, error: snapshot.error }, { status, headers: noStore })
  }
  return NextResponse.json(
    {
      ...snapshot,
      policy: {
        rounding: "floor_atomic",
        withdrawalFeeBps: 300,
        withdrawalFeeNote: "3% of gross; net sent to Pi wallet linked at authentication",
        concurrentReserves: "pg_advisory_xact_lock per user",
        authority: "gh_earnings_ledger_entries",
      },
      ok: true,
    },
    { headers: noStore },
  )
}
