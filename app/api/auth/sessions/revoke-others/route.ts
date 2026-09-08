/**
 * POST /api/auth/sessions/revoke-others
 * Revoke all sessions for the current user except the current session.
 * Requires recent server step-up (Phase 4) — high-impact security action.
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { revokeOtherSessionsForUser } from "@/lib/server/identity/session-store"
import { requireRecentStepUp, revokeStepUpsForSession } from "@/lib/server/identity/step-up-store"
import { listSessionsForUser } from "@/lib/server/identity/session-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    pruneRateLimitBuckets()
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    if (auth.source !== "gh_session" || !auth.sessionId) {
      return NextResponse.json(
        { ok: false, error: "SESSION_REQUIRED" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

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
        await revokeStepUpsForSession(s.id)
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
    return NextResponse.json(
      { ok: false, error: "REVOKE_OTHERS_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
