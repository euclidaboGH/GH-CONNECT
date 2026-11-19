/**
 * POST /api/engagement/pioneer-activity
 * Authenticated client reports a meaningful action (rate-limited).
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import {
  recordPioneerActivity,
  type PioneerActivityKind,
} from "@/lib/server/engagement/pioneer-activity"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED = new Set<PioneerActivityKind>([
  "session_verified",
  "onboarding_completed",
  "profile_updated",
  "post_created",
  "community_joined",
  "message_sent",
  "marketplace_browse",
  "payment_completed",
])

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const rl = checkRateLimit(`pioneer-act:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }
  const durableLimit = await checkDurableRateLimit(`pioneer-activity:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!durableLimit.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(durableLimit), retryAfterSec: durableLimit.retryAfterSec }, { status: durableRateLimitStatus(durableLimit), headers: { "Cache-Control": "no-store", "Retry-After": String(durableLimit.retryAfterSec) } })
  const parsedBody = await readBoundedJson(request, 64 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
  const body = parsedBody.value
  const kind = String(body.kind || "").trim() as PioneerActivityKind
  if (!ALLOWED.has(kind)) {
    return NextResponse.json({ ok: false, error: "INVALID_KIND" }, { status: 400 })
  }
  await recordPioneerActivity({ userId: auth.userId, kind })
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}
