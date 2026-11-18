/**
 * GET /api/auth/sessions
 * List active/recent sessions for the authenticated GH user only.
 * Never returns tokens or token hashes.
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  listSessionsForUser,
  toPublicSessionInfo,
} from "@/lib/server/identity/session-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
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
        {
          ok: false,
          error: "SESSION_REQUIRED",
          detail: "Device session list requires a GreenHaven server session.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    const rl = checkRateLimit(`sessions_list:${auth.userId}`, 30, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Ignore any client-supplied userId
    const sessions = await listSessionsForUser(auth.userId)
    const publicList = sessions.map((s) =>
      toPublicSessionInfo(s, auth.sessionId || null)
    )

    return NextResponse.json(
      {
        ok: true,
        sessions: publicList,
        currentSessionId: auth.sessionId,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[auth/sessions] list failed",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "SESSIONS_LIST_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
