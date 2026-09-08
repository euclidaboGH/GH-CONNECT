/**
 * POST /api/auth/pi
 *
 * Official Pi identity bridge + GH server session issuance (Phase 2B):
 * 1) Client sends accessToken from Pi.authenticate()
 * 2) Server verifies with GET /v2/me
 * 3) Durable identity mapping
 * 4) Issue GH CONNECT server session (HttpOnly cookie)
 * 5) Return non-secret identity + onboarding flags
 *
 * Never trust client-supplied uid or ghUserId.
 * Never store Pi access tokens in session table.
 */

import { NextResponse } from "next/server"
import { verifyPiAccessToken } from "@/lib/server/economy/auth"
import {
  findOrCreateFromVerifiedPi,
  touchLastSeen,
  isPiIdentityDurable,
} from "@/lib/server/identity/pi-identity-store"
import {
  createSession,
  buildSessionCookieHeader,
  isSessionStoreDurable,
} from "@/lib/server/identity/session-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken.trim() : ""

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "accessToken required" },
        { status: 400 }
      )
    }

    const piUser = await verifyPiAccessToken(accessToken)
    if (!piUser?.uid) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_PI_TOKEN",
          detail:
            "Pi /me rejected the access token. Re-authenticate in Pi Browser.",
        },
        { status: 401 }
      )
    }

    const { record, isNew } = await findOrCreateFromVerifiedPi({
      piAppUid: piUser.uid,
      piUsername: piUser.username ?? null,
    })

    void touchLastSeen(record.ghUserId)

    const isReturning = !isNew && record.onboardingCompleted === true
    const needsOnboarding = !record.onboardingCompleted

    // Issue GH server session only after verified Pi identity
    const ua = request.headers.get("user-agent")
    const issued = await createSession({
      ghUserId: record.ghUserId,
      userAgent: ua,
    })

    const res = NextResponse.json(
      {
        ok: true,
        verified: true,
        isNew,
        isReturning,
        needsOnboarding,
        durable: isPiIdentityDurable(),
        sessionDurable: isSessionStoreDurable(),
        session: {
          id: issued.record.id,
          expiresAt: issued.record.expiresAt,
          absoluteExpiresAt: issued.record.absoluteExpiresAt,
        },
        identity: {
          ghUserId: record.ghUserId,
          piAppUid: record.piAppUid,
          piUsername: record.piUsername,
          onboardingCompleted: record.onboardingCompleted,
          verifiedAt: record.verifiedAt,
          lastSeenAt: record.lastSeenAt,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )

    res.headers.append(
      "Set-Cookie",
      buildSessionCookieHeader(issued.rawToken)
    )

    return res
  } catch (err) {
    console.error(
      "[auth/pi] bridge failed",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      {
        ok: false,
        error: "AUTH_BRIDGE_FAILED",
      },
      { status: 500 }
    )
  }
}
