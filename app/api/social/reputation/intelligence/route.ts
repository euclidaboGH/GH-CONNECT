import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { getPublicReputationIntelligence, refreshReputationIntelligence } from "@/lib/server/reputation/intelligence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`rep-intelligence:${auth.userId}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })

  const current = await getPublicReputationIntelligence(auth.userId)
  if (!current.ok) return NextResponse.json({ ok: false, error: current.error || "UNAVAILABLE" }, { status: 503 })
  if (current.data.available === false) {
    const refreshed = await refreshReputationIntelligence(auth.userId)
    if (refreshed.ok) return NextResponse.json({ ok: true, durable: true, intelligence: refreshed.data })
  }
  return NextResponse.json({ ok: true, durable: true, intelligence: current.data })
}
