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
import { getServerProfile, getOnboardingProfileGaps, upsertServerProfile } from "@/lib/server/identity/profile-store"
import { recordPioneerActivity } from "@/lib/server/engagement/pioneer-activity"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"

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
    const __rateLimited = await enforceUserMutationRateLimit(auth.userId, "auth/onboarding-complete:POST", 60, 60_000, { failClosed: false })
    if (__rateLimited) return __rateLimited

    let ghUserId = auth.userId
    const byPi = await getByPiAppUid(auth.userId)
    if (byPi) {
      ghUserId = byPi.ghUserId
    } else {
      const byGh = await getByGhUserId(auth.userId)
      if (byGh) {
        ghUserId = byGh.ghUserId
      } else if (auth.source === "pi_platform") {
        const { record } = await findOrCreateFromVerifiedPi({
          piAppUid: auth.userId,
          piUsername: auth.username ?? null,
        })
        ghUserId = record.ghUserId
      }
    }

    // Registration is complete only when every required field is durably saved.
    // This is checked server-side so a modified client cannot skip onboarding steps.
    const savedProfile = await getServerProfile(ghUserId)
    const missingFields = getOnboardingProfileGaps(savedProfile)
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "ONBOARDING_PROFILE_INCOMPLETE",
          missingFields,
          detail: "Save all required profile details before completing registration.",
        },
        { status: 422, headers: { "Cache-Control": "no-store" } }
      )
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

    try {
      await upsertServerProfile(updated.ghUserId, { onboarded: true }, { allowOnboardedChange: true })
    } catch {
      /* non-blocking */
    }

    void recordPioneerActivity({
      userId: updated.ghUserId,
      kind: "onboarding_completed",
    })

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
