import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { attributeReferral, ensureReferralCode } from "@/lib/server/referral/referral-service"
import { resolvePublicIdentity } from "@/lib/server/economy/public-id"
import { normalizeGreenHavenId, isValidGreenHavenIdFormat } from "@/lib/domains/greenhaven-id"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function resolveUserIdFromGreenHavenId(ghId: string): Promise<string | null> {
  // Referral attribution must use the same durable public-ID directory as GHC
  // transfers and the public-ID resolver. Legacy profile-column probing caused
  // valid IDs to be rejected whenever the current identity lived in
  // ghc_public_identities rather than legacy profile columns.
  const normalized = normalizeGreenHavenId(ghId)
  if (!isValidGreenHavenIdFormat(normalized)) return null
  const identity = await resolvePublicIdentity(normalized)
  return identity?.userId || null
}

/** POST — attribute the authenticated user to a referral code OR GreenHaven ID (once) */
export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const raw = await request.json().catch(() => ({}))
  const parsed = z
    .object({
      code: z.string().min(2).max(32).optional(),
      greenHavenId: z.string().min(4).max(40).optional(),
      referrerGreenHavenId: z.string().min(4).max(40).optional(),
    })
    .safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 })
  }

  let code = (parsed.data.code || "").trim()
  const ghId = (parsed.data.greenHavenId || parsed.data.referrerGreenHavenId || "").trim()
  if (!code && ghId) {
    const referrerUserId = await resolveUserIdFromGreenHavenId(ghId)
    if (!referrerUserId) {
      return NextResponse.json(
        { ok: false, error: "INVALID_GREENHAVEN_ID", message: "That GreenHaven ID was not found." },
        { status: 400 }
      )
    }
    if (referrerUserId === auth.userId) {
      return NextResponse.json({ ok: false, error: "SELF_REFERRAL" }, { status: 400 })
    }
    const ensured = await ensureReferralCode(referrerUserId)
    if (!ensured.ok || !ensured.code) {
      return NextResponse.json({ ok: false, error: "REFERRER_CODE_UNAVAILABLE" }, { status: 503 })
    }
    code = ensured.code
  }
  if (!code) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 })
  }

  const result = await attributeReferral(auth.userId, code)
  if (!result.ok) {
    const status =
      result.error === "SELF_REFERRAL" ||
      result.error === "INVALID_CODE" ||
      result.error === "ALREADY_ATTRIBUTED"
        ? 400
        : 503
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        message:
          result.error === "ALREADY_ATTRIBUTED"
            ? "Referral can only be submitted once."
            : result.error === "INVALID_CODE"
              ? "That referral code or GreenHaven ID is not valid."
              : undefined,
      },
      { status }
    )
  }
  return NextResponse.json({
    ok: true,
    idempotent: result.idempotent,
    message: result.idempotent
      ? "Referral already recorded."
      : "Referral locked in — rewards apply when membership settlement is enabled.",
  })
}
