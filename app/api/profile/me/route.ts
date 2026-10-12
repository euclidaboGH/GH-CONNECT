/**
 * GET/PATCH /api/profile/me
 * Server-authoritative social profile for the authenticated GH user.
 * Never trusts client userId for ownership. No balances/membership in this resource.
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { awardProgressionXp } from "@/lib/server/progression/award"
import { qualifyGrowthReferral } from "@/lib/server/growth/referrals"
import {
  getServerProfile,
  upsertServerProfile,
  serverProfileToClientPartial,
  isProfileStoreDurable,
} from "@/lib/server/identity/profile-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }

    const rec = await getServerProfile(auth.userId)
    return NextResponse.json(
      {
        ok: true,
        durable: isProfileStoreDurable(),
        profile: rec ? serverProfileToClientPartial(rec) : null,
        exists: Boolean(rec),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[profile/me GET]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "PROFILE_LOAD_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }

    const body = await request.json().catch(() => ({}))
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Ignore any client-supplied identity / financial fields (session auth is sole owner)
    const input = { ...(body as Record<string, unknown>) }
    delete input.id
    delete input.userId
    delete input.ghUserId
    delete input.gh_user_id
    delete input.piId
    delete input.piAppUid
    delete input.ownerId
    delete input.balance
    delete input.membership
    delete input.tier

    const saved = await upsertServerProfile(auth.userId, input)
    if (!saved) {
      return NextResponse.json(
        {
          ok: false,
          error: "PROFILE_PERSIST_FAILED",
          detail: "Server profile store unavailable or write failed",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Award a one-time non-financial milestone only after a durable profile write.
    // XP does not grant GHC, membership, or reputation privileges.
    if (saved.onboarded && saved.displayName && saved.bio && saved.bio.length >= 20 && saved.interests.length >= 3) {
      await awardProgressionXp({
        userId: auth.userId,
        eventType: "profile_completed",
        xp: 25,
        idempotencyKey: `profile-completed:${auth.userId}`,
        sourceRef: `profile:${auth.userId}`,
        metadata: { rulesVersion: "progression-v1" },
      })
      await qualifyGrowthReferral({ referredUserId: auth.userId, event: "profile_verified", evidenceRef: `profile:${auth.userId}` })
    }

    return NextResponse.json(
      {
        ok: true,
        durable: isProfileStoreDurable(),
        profile: serverProfileToClientPartial(saved),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[profile/me PATCH]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "PROFILE_SAVE_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
