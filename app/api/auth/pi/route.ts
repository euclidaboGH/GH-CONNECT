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
  markOnboardingCompleted,
} from "@/lib/server/identity/pi-identity-store"
import {
  createSession,
  buildSessionCookieHeader,
  isSessionStoreDurable,
} from "@/lib/server/identity/session-store"
import { getServerProfile } from "@/lib/server/identity/profile-store"

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

    const prod =
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.GHC_ENV === "production"
    // Production must not issue identity/session from process memory — returning
    // users would look new after cold starts. Fail closed with a clear error.
    if (prod && (!isPiIdentityDurable() || !isSessionStoreDurable())) {
      console.error("[auth/pi] IDENTITY_STORE_UNAVAILABLE", {
        identityDurable: isPiIdentityDurable(),
        sessionDurable: isSessionStoreDurable(),
      })
      return NextResponse.json(
        {
          ok: false,
          error: "IDENTITY_STORE_UNAVAILABLE",
          detail:
            "Server identity storage is not configured. Operators must set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and apply gh_pi_identities / gh_sessions migrations.",
        },
        { status: 503 }
      )
    }

    let record
    let isNew
    try {
      const result = await findOrCreateFromVerifiedPi({
        piAppUid: piUser.uid,
        piUsername: piUser.username ?? null,
      })
      record = result.record
      isNew = result.isNew
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown"
      if (msg === "IDENTITY_DURABILITY_UNAVAILABLE") {
        return NextResponse.json(
          {
            ok: false,
            error: "IDENTITY_STORE_UNAVAILABLE",
            detail:
              "Durable identity write failed. Check Supabase connectivity and migrations.",
          },
          { status: 503 }
        )
      }
      throw err
    }

    void touchLastSeen(record.ghUserId)

    // Case: durable social profile already onboarded for THIS gh_user_id, but
    // identity flag was never flipped (legacy / partial completion). Reconcile
    // only for the verified mapping — never auto-onboard unrelated identities.
    let isReturning = !isNew && record.onboardingCompleted === true
    let needsOnboarding = record.onboardingCompleted !== true
    if (needsOnboarding && !isNew && record.ghUserId) {
      try {
        const existingProfile = await getServerProfile(record.ghUserId)
        if (existingProfile?.onboarded === true) {
          const reconciled = await markOnboardingCompleted(record.ghUserId)
          if (reconciled?.onboardingCompleted === true) {
            record = reconciled
            needsOnboarding = false
            isReturning = true
          }
        }
      } catch {
        /* profile store optional — identity flag remains authoritative */
      }
    }

    // Issue GH server session only after verified Pi identity
    const ua = request.headers.get("user-agent")
    let issued
    try {
      issued = await createSession({
        ghUserId: record.ghUserId,
        userAgent: ua,
      })
    } catch (sessErr) {
      const msg = sessErr instanceof Error ? sessErr.message : "unknown"
      if (msg.includes("DURABILITY") || (prod && !isSessionStoreDurable())) {
        return NextResponse.json(
          {
            ok: false,
            error: "SESSION_STORE_UNAVAILABLE",
            detail: "Durable session storage failed.",
          },
          { status: 503 }
        )
      }
      throw sessErr
    }

    const identityDurable = isPiIdentityDurable()
    const sessionDurable = isSessionStoreDurable()
    // durabilityWarning only for non-production degraded mode (should not appear in prod after fail-closed)
    const durabilityWarning =
      !prod && (!identityDurable || !sessionDurable)
        ? "IDENTITY_OR_SESSION_NOT_DURABLE: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and apply gh_pi_identities / gh_sessions migrations."
        : undefined

    const res = NextResponse.json(
      {
        ok: true,
        verified: true,
        isNew,
        isReturning,
        needsOnboarding,
        durable: identityDurable,
        sessionDurable,
        ...(durabilityWarning ? { durabilityWarning } : {}),
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
    const msg = err instanceof Error ? err.message : ""
    if (msg === "IDENTITY_DURABILITY_UNAVAILABLE") {
      return NextResponse.json(
        {
          ok: false,
          error: "IDENTITY_STORE_UNAVAILABLE",
          detail:
            "Durable identity storage is unavailable on this deployment.",
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      {
        ok: false,
        error: "AUTH_BRIDGE_FAILED",
      },
      { status: 500 }
    )
  }
}
