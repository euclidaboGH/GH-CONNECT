/** Authenticated unified earnings balances + statement (Phase 3). Server-authoritative only. */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { getEarningsStatement } from "@/lib/server/earnings/unified-ledger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  }
  const limit = checkRateLimit(`earnings-stmt:${auth.userId}`, 60, 60_000)
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
  }
  const url = new URL(request.url)
  const rowLimit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50) || 50))
  const statement = await getEarningsStatement(auth.userId, rowLimit)
  if (!statement.ok) {
    const status = statement.error === "EARNINGS_LEDGER_UNAVAILABLE" ? 503 : 409
    return NextResponse.json({ ok: false, error: statement.error }, { status, headers: noStore })
  }
  return NextResponse.json(
    {
      ok: true,
      asset: "PI",
      balances: statement.balances,
      entries: statement.entries,
      authority: "gh_earnings_ledger_entries",
    },
    { headers: noStore },
  )
}
