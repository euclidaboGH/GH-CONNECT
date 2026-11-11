/**
 * POST /api/auth/sessions/revoke-others
 * Revoke all sessions for the current user except the current session.
 * Requires recent server step-up (Phase 4) — high-impact security action.
 */

import { NextResponse } from "next/server"
import { revokeOtherSessionsForUser } from "@/lib/server/identity/session-store"
import { requireAccountSecurityContext } from "@/lib/server/identity/auth-integrity"
import { requireRecentStepUp, revokeStepUpsForSession } from "@/lib/server/identity/step-up-store"
import { listSessionsForUser } from "@/lib/server/identity/session-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    pruneRateLimitBuckets()
    // Central gate enforces both a gh_session and durable session storage in production.
    const security = await requireAccountSecurityContext(request.headers)
    if (!security.ok) return security.response
    const auth = security.auth

    const rl = checkRateLimit(`sessions_revoke_others:${auth.userId}`, 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "RATE_LIMITED",
          detail: `Retry in ${rl.retryAfterSec}s`,
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Policy: revoke-all-others requires recent step-up
    const stepErr = await requireRecentStepUp(auth)
    if (stepErr) {
      return NextResponse.json(
        { ok: false, error: stepErr.code, detail: stepErr.message },
        { status: stepErr.status, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Collect other session ids for step-up revoke before killing sessions
    const all = await listSessionsForUser(auth.userId)
    for (const s of all) {
      if (s.id !== auth.sessionId && s.revokedAt == null) {
        const stepUpsRevoked = await revokeStepUpsForSession(s.id)
        if (!stepUpsRevoked) {
          return NextResponse.json(
            { ok: false, error: "STEP_UP_REVOCATION_UNAVAILABLE" },
            { status: 503, headers: { "Cache-Control": "no-store" } }
          )
        }
      }
    }

    const count = await revokeOtherSessionsForUser(auth.userId, auth.sessionId)

    return NextResponse.json(
      {
        ok: true,
        revokedCount: count,
        currentSessionId: auth.sessionId,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[auth/sessions/revoke-others] failed",
      err instanceof Error ? err.message : "unknown"
    )
    const durabilityFailure = err instanceof Error && /SESSION_REVOCATION_UNAVAILABLE/.test(err.message)
    return NextResponse.json(
      { ok: false, error: durabilityFailure ? "SESSION_REVOCATION_UNAVAILABLE" : "REVOKE_OTHERS_FAILED" },
      { status: durabilityFailure ? 503 : 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
