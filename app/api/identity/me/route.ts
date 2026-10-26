/**
 * GET /api/identity/me — server-verified Pioneer identity for UI badges and referral share.
 * Never invents Pi linkage: only data from durable session + gh_pi_identities (+ public id).
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getByGhUserId } from "@/lib/server/identity/pi-identity-store"
import { ensurePublicIdentity } from "@/lib/server/economy/public-id"
import { deriveGreenHavenId } from "@/lib/domains/greenhaven-id"
import { isPiOnlyCommerceEnabled } from "@/lib/server/economy/pi-only-commerce"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: "AUTH_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const pi = await getByGhUserId(auth.userId)
  const serverVerified = Boolean(pi?.piAppUid && pi.verifiedAt)

  let greenHavenId = deriveGreenHavenId(auth.userId)
  try {
    const pub = await ensurePublicIdentity({ userId: auth.userId })
    if (pub?.publicId) greenHavenId = String(pub.publicId)
  } catch {
    /* derived still usable for display */
  }

  return NextResponse.json(
    {
      ok: true,
      authenticated: true,
      serverVerified,
      ghUserId: auth.userId,
      greenHavenId,
      piUsername: pi?.piUsername || null,
      piAppUidPresent: Boolean(pi?.piAppUid),
      verifiedAt: pi?.verifiedAt || null,
      onboardingCompleted: pi?.onboardingCompleted === true,
      /** Pi-only fee posture — informational for UI copy */
      piOnlyCommerce: isPiOnlyCommerceEnabled(),
      /** Explicit separation: GHC is not a payment rail when pi-only commerce is on */
      ghcPaymentRailEnabled: !isPiOnlyCommerceEnabled(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
