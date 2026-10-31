/**
 * GET /api/security/account-signals
 * Read-only anti-fraud readiness for the authenticated user.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { buildAccountSignals } from "@/lib/server/security/account-signals"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  const payload = await buildAccountSignals(auth.userId)
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
}
