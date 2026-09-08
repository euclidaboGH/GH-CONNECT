/**
 * POST /api/auth/step-up
 *
 * Establish short-lived server-side step-up for an existing GH session.
 * Requires:
 * - Valid GH server session (cookie)
 * - Fresh Pi accessToken verified via /v2/me
 * - Verified Pi identity maps to the same GH user as the session
 *
 * Does NOT create a new login session.
 * Does NOT store access tokens.
 * Does NOT accept client stepUp flags.
 */

import { NextResponse } from "next/server"
import {
  resolveAuthenticatedUser,
  verifyPiAccessToken,
} from "@/lib/server/economy/auth"
import { getByPiAppUid, getByGhUserId } from "@/lib/server/identity/pi-identity-store"
import {
  createStepUp,
  rateLimitStepUp,
  STEP_UP_TTL_MS,
} from "@/lib/server/identity/step-up-store"
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
        {
          ok: false,
          error: "SESSION_REQUIRED",
          detail: "Step-up requires an active GreenHaven server session cookie.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    const rl = rateLimitStepUp(auth.userId)
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "RATE_LIMITED",
          detail: `Too many step-up attempts; retry in ${rl.retryAfterSec}s`,
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }

    const body = await request.json().catch(() => ({}))
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken.trim() : ""

    // Reject client-forged step-up claims
    if (body.stepUp === true && !accessToken) {
      console.info("[step-up] STEP_UP_FAILURE", { reason: "client_flag_only" })
      return NextResponse.json(
        { ok: false, error: "INVALID_STEP_UP" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "accessToken required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Fresh Pi Platform verification — never trust body.uid
    const piUser = await verifyPiAccessToken(accessToken)
    if (!piUser?.uid) {
      console.info("[step-up] STEP_UP_FAILURE", { reason: "invalid_pi_token" })
      return NextResponse.json(
        { ok: false, error: "INVALID_PI_TOKEN" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Map Pi identity → GH user; must match session user
    let mappedGhUserId: string | null = null
    const byPi = await getByPiAppUid(piUser.uid)
    if (byPi) {
      mappedGhUserId = byPi.ghUserId
    } else {
      const byGh = await getByGhUserId(piUser.uid)
      if (byGh) mappedGhUserId = byGh.ghUserId
      else if (piUser.uid === auth.userId) {
        // First-link edge: session user id may equal pi uid
        mappedGhUserId = auth.userId
      }
    }

    if (!mappedGhUserId || mappedGhUserId !== auth.userId) {
      console.info("[step-up] STEP_UP_IDENTITY_MISMATCH", {
        sessionUser: auth.userId,
        piUid: piUser.uid,
      })
      // Rate-limit mismatch probing lightly
      checkRateLimit(`step_up_mismatch:${auth.userId}`, 5, 60_000)
      return NextResponse.json(
        { ok: false, error: "IDENTITY_MISMATCH" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    const record = await createStepUp({
      ghUserId: auth.userId,
      sessionId: auth.sessionId,
      authMethod: "pi_fresh_auth",
    })

    return NextResponse.json(
      {
        ok: true,
        stepUp: {
          expiresAt: record.expiresAt,
          ttlMs: STEP_UP_TTL_MS,
          authMethod: record.authMethod,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[step-up] failed",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "STEP_UP_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
