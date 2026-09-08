/**
 * POST /api/auth/onboarding-complete
 * Marks GreenHaven onboarding finished for the verified Pi-linked identity.
 * Requires Bearer token verified via resolveAuthenticatedUser (Pi /me or allowed paths).
 * Idempotent. Never trusts client-supplied userId as ownership proof.
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getByGhUserId,
  getByPiAppUid,
  markOnboardingCompleted,
  findOrCreateFromVerifiedPi,
} from "@/lib/server/identity/pi-identity-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401 }
      )
    }

    // Reject body-supplied user identity as proof of ownership
    // (client may send nothing; we ignore userId from body entirely)

    // Resolve mapping from verified auth subject only
    let ghUserId = auth.userId
    const byPi = await getByPiAppUid(auth.userId)
    if (byPi) {
      ghUserId = byPi.ghUserId
    } else {
      const byGh = await getByGhUserId(auth.userId)
      if (byGh) {
        ghUserId = byGh.ghUserId
      } else if (auth.source === "pi_platform") {
        // Edge: /me succeeded but mapping missing (e.g. cold start before /api/auth/pi).
        // Create mapping from verified Pi uid only — still no client-supplied id.
        const { record } = await findOrCreateFromVerifiedPi({
          piAppUid: auth.userId,
          piUsername: auth.username ?? null,
        })
        ghUserId = record.ghUserId
      }
    }

    const updated = await markOnboardingCompleted(ghUserId)
    if (!updated) {
      console.error("[auth/onboarding-complete] IDENTITY_NOT_FOUND", {
        source: auth.source,
      })
      return NextResponse.json(
        {
          ok: false,
          error: "IDENTITY_NOT_FOUND",
          detail: "Call POST /api/auth/pi first after Pi.authenticate",
        },
        { status: 404 }
      )
    }

    // Idempotent: already-completed still returns ok:true
    return NextResponse.json({
      ok: true,
      identity: {
        ghUserId: updated.ghUserId,
        piAppUid: updated.piAppUid,
        piUsername: updated.piUsername,
        onboardingCompleted: updated.onboardingCompleted,
      },
    })
  } catch (err) {
    console.error(
      "[auth/onboarding-complete] failed",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      {
        ok: false,
        error: "ONBOARDING_COMPLETE_FAILED",
      },
      { status: 500 }
    )
  }
}
