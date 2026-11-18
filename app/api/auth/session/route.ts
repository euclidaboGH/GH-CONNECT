/**
 * GET /api/auth/session
 * Returns non-secret status of the current GH server session (if any).
 * Does not expose raw tokens.
 */

import { NextResponse } from "next/server"
import {
  extractSessionTokenFromCookie,
  validateSession,
  isSessionStoreDurable,
} from "@/lib/server/identity/session-store"
import { getByGhUserId } from "@/lib/server/identity/pi-identity-store"
import { deriveGreenHavenId } from "@/lib/domains/greenhaven-id"
import { requestCorrelationId } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const correlationId = requestCorrelationId(request)
  try {
    const token = extractSessionTokenFromCookie(request.headers)
    if (!token) {
      console.warn("[GH_PI_AUTH_STAGE]", { code: "PI_SESSION_COOKIE_MISSING", stage: "session_cookie_check", correlationId })
      return NextResponse.json(
        { ok: true, authenticated: false, reason: "NO_SESSION", diagnosticCode: "PI_SESSION_COOKIE_MISSING", correlationId },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    const session = await validateSession(token, { touch: true })
    if (!session) {
      console.warn("[GH_PI_AUTH_STAGE]", { code: "PI_SESSION_COOKIE_INVALID", stage: "session_cookie_check", correlationId })
      return NextResponse.json(
        { ok: true, authenticated: false, reason: "SESSION_INVALID", diagnosticCode: "PI_SESSION_COOKIE_INVALID", correlationId },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    let piUsername: string | null = null
    let serverVerified = false
    try {
      const pi = await getByGhUserId(session.ghUserId)
      if (pi?.piAppUid) {
        serverVerified = true
        piUsername = pi.piUsername
      }
    } catch {
      /* */
    }
    console.info("[GH_PI_AUTH_STAGE]", { code: "PI_SESSION_COOKIE_VALID", stage: "session_cookie_check", correlationId, durable: isSessionStoreDurable(), identityVerified: serverVerified })
    return NextResponse.json(
      {
        ok: true,
        authenticated: true,
        durable: isSessionStoreDurable(),
        session: {
          id: session.id,
          ghUserId: session.ghUserId,
          expiresAt: session.expiresAt,
          absoluteExpiresAt: session.absoluteExpiresAt,
          lastSeenAt: session.lastSeenAt,
        },
        diagnosticCode: "PI_SESSION_COOKIE_VALID",
        correlationId,
        identity: {
          serverVerified,
          piUsername,
          greenHavenId: deriveGreenHavenId(session.ghUserId),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error("[GH_PI_AUTH_STAGE]", { code: "PI_SESSION_STATUS_FAILED", stage: "session_cookie_check", correlationId, errorName: err instanceof Error ? err.name : "UnknownError" })
    return NextResponse.json(
      { ok: false, error: "SESSION_STATUS_FAILED", diagnosticCode: "PI_SESSION_STATUS_FAILED", correlationId },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
