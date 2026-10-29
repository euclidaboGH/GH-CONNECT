/**
 * One-time PI registration bonus status + claim.
 * GET: status · POST: claim (idempotent via unique_ref on ledger).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  claimRegistrationBonus,
  getRegistrationBonusStatus,
} from "@/lib/server/earnings/registration-bonus"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = checkRateLimit(`reg-bonus-get:${auth.userId}`, 60, 60_000)
  if (!limit.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)
  const status = await getRegistrationBonusStatus(auth.userId)
  const http =
    status.error === "EARNINGS_LEDGER_UNAVAILABLE" ? 503 : status.ok ? 200 : 409
  return reply({ ...status, ok: status.ok !== false }, http)
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = checkRateLimit(`reg-bonus-claim:${auth.userId}`, 10, 60_000)
  if (!limit.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)
  // Body ignored — amount and eligibility are server-derived only
  const result = await claimRegistrationBonus(auth.userId)
  if (result.error === "EARNINGS_LEDGER_UNAVAILABLE") {
    return reply({ ...result, ok: false }, 503)
  }
  if (!result.ok) return reply({ ...result, ok: false }, 409)
  return reply({ ...result, ok: true }, 200)
}
