/**
 * POST /api/auth/logout
 * Revokes the current GH server session, associated step-ups, and clears the session cookie.
 * Does not revoke Pi Network global auth.
 * Does not destroy user data, profiles, or ledger.
 */

import { NextResponse } from "next/server"
import {
  extractSessionTokenFromCookie,
  revokeSessionByToken,
  buildClearSessionCookieHeader,
  validateSession,
} from "@/lib/server/identity/session-store"
import { revokeStepUpsForSession } from "@/lib/server/identity/step-up-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const token = extractSessionTokenFromCookie(request.headers)
    if (token) {
      const session = await validateSession(token, { touch: false })
      if (session?.id) {
        const revoked = await revokeSessionByToken(token)
        if (!revoked) {
          const res = NextResponse.json(
            { ok: false, loggedOut: false, error: "SESSION_REVOCATION_UNAVAILABLE" },
            { status: 503, headers: { "Cache-Control": "no-store" } }
          )
          res.headers.append("Set-Cookie", buildClearSessionCookieHeader())
          return res
        }
        const stepUpsRevoked = await revokeStepUpsForSession(session.id)
        if (!stepUpsRevoked) {
          const res = NextResponse.json(
            { ok: false, loggedOut: false, error: "STEP_UP_REVOCATION_UNAVAILABLE" },
            { status: 503, headers: { "Cache-Control": "no-store" } }
          )
          res.headers.append("Set-Cookie", buildClearSessionCookieHeader())
          return res
        }
      }
    }

    const res = NextResponse.json(
      { ok: true, loggedOut: true },
      { headers: { "Cache-Control": "no-store" } }
    )
    res.headers.append("Set-Cookie", buildClearSessionCookieHeader())
    return res
  } catch (err) {
    console.error(
      "[auth/logout] failed",
      err instanceof Error ? err.message : "unknown"
    )
    const res = NextResponse.json(
      { ok: false, loggedOut: false, error: "SESSION_REVOCATION_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
    res.headers.append("Set-Cookie", buildClearSessionCookieHeader())
    return res
  }
}
