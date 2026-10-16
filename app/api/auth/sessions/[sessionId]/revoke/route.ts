/**
 * POST /api/auth/sessions/[sessionId]/revoke
 * Revoke one session owned by the authenticated user.
 * IDOR-safe: ownership checked server-side.
 * If revoking the current session → clear cookie (sign out this device).
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  revokeSessionByIdForUser,
  buildClearSessionCookieHeader,
} from "@/lib/server/identity/session-store"
import { revokeStepUpsForSession } from "@/lib/server/identity/step-up-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  ctx: { params: Promise<{ sessionId: string }> }
) {
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

    const rl = checkRateLimit(`sessions_revoke:${auth.userId}`, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }

    const { sessionId: rawId } = await ctx.params
    const targetId = decodeURIComponent(String(rawId || "").trim())
    if (!targetId) {
      return NextResponse.json(
        { ok: false, error: "SESSION_ID_REQUIRED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Ownership enforced inside revokeSessionByIdForUser
    const result = await revokeSessionByIdForUser(auth.userId, targetId)
    if (result === "not_found") {
      return NextResponse.json(
        { ok: false, error: "SESSION_NOT_FOUND" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
    }
    if (result === "forbidden") {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    await revokeStepUpsForSession(targetId)

    const isCurrent = targetId === auth.sessionId
    const res = NextResponse.json(
      {
        ok: true,
        revokedSessionId: targetId,
        wasCurrent: isCurrent,
      },
      { headers: { "Cache-Control": "no-store" } }
    )

    if (isCurrent) {
      res.headers.append("Set-Cookie", buildClearSessionCookieHeader())
    }

    return res
  } catch (err) {
    console.error(
      "[auth/sessions/revoke] failed",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "SESSION_REVOKE_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
