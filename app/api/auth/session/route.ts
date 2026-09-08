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

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const token = extractSessionTokenFromCookie(request.headers)
    if (!token) {
      return NextResponse.json(
        { ok: true, authenticated: false, reason: "NO_SESSION" },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    const session = await validateSession(token, { touch: true })
    if (!session) {
      return NextResponse.json(
        { ok: true, authenticated: false, reason: "SESSION_INVALID" },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

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
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[auth/session] failed",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "SESSION_STATUS_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
