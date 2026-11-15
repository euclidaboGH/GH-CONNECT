import { NextResponse } from "next/server"
import { normalizeCharityImpactSummary } from "@/lib/ecosystem/charity-impact"
import { getEcosystemServiceAccess } from "@/lib/server/ecosystem/service-release"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getCharityUserSummary } from "@/lib/server/earnings/platform-utility"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie, Authorization" }

/** Read-only prelaunch impact summary. The charity service stays gated until release. */
export async function GET(request: Request) {
  const access = getEcosystemServiceAccess("charity")
  if (!access.allowed) return NextResponse.json({ ok: false, error: access.reason }, { status: 404, headers: NO_STORE })

  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`ecosystem-charity-summary:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, {
    status: durableRateLimitStatus(rate),
    headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) },
  })

  const raw = await getCharityUserSummary(auth.userId)
  if (!raw || typeof raw !== "object" || (raw as Record<string, unknown>).userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: "CHARITY_SUMMARY_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  }
  const summary = normalizeCharityImpactSummary(raw)
  if (!summary) return NextResponse.json({ ok: false, error: "CHARITY_SUMMARY_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, durable: true, ...summary }, { headers: NO_STORE })
}
