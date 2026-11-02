/**
 * GET /api/profile/export — authenticated export of the caller's own profile and identity summary.
 * Deliberately excludes session cookies, Pi access tokens, internal UIDs and financial records.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { getServerProfile, serverProfileToClientPartial } from "@/lib/server/identity/profile-store"
import { getByGhUserId } from "@/lib/server/identity/pi-identity-store"
import { deriveGreenHavenId } from "@/lib/domains/greenhaven-id"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    const limit = checkRateLimit(`profile-export:${auth.userId}`, 5, 60 * 60_000)
    if (!limit.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSec) } })

    const [profile, pi] = await Promise.all([
      getServerProfile(auth.userId),
      getByGhUserId(auth.userId),
    ])
    return NextResponse.json({
      ok: true,
      export: {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        account: {
          greenHavenId: deriveGreenHavenId(auth.userId),
          piUsername: pi?.piUsername || null,
          piIdentityVerified: Boolean(pi?.piAppUid && pi?.verifiedAt),
          piIdentityVerifiedAt: pi?.verifiedAt || null,
          onboardingCompleted: pi?.onboardingCompleted === true,
        },
        profile: profile ? serverProfileToClientPartial(profile) : null,
        scope: "Profile and identity summary available to this authenticated account; excludes tokens, session secrets, internal Pi UID, wallet balances and financial records.",
      },
    }, { headers: { "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="greenhaven-personal-data.json"' } })
  } catch (error) {
    console.error("[profile/export GET]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "PROFILE_EXPORT_FAILED" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
