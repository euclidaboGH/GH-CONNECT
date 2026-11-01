import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { attributeReferral, ensureReferralCode } from "@/lib/server/referral/referral-service"
import { resolvePublicIdentity } from "@/lib/server/economy/public-id"
import { normalizeGreenHavenId, isValidGreenHavenIdFormat } from "@/lib/domains/greenhaven-id"
import { getByPiAppUid, getByPiUsername, getByGhUserId } from "@/lib/server/identity/pi-identity-store"
import { z } from "zod"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Resolve a referrer from any of:
 * - Referral code (preferred share path)
 * - GreenHaven public ID (GH-XXXXXX)
 * - Pi app uid
 * - Pi username (@name)
 * - Internal GreenHaven user id (UUID) when already linked
 *
 * Never invents referrers; ambiguous Pi usernames return null.
 */
async function resolveReferrerUserId(raw: string): Promise<{ userId: string | null; via: string }> {
  const input = String(raw || "").trim()
  if (!input) return { userId: null, via: "empty" }

  // GreenHaven public ID
  const asGh = normalizeGreenHavenId(input)
  if (isValidGreenHavenIdFormat(asGh)) {
    const identity = await resolvePublicIdentity(asGh)
    if (identity?.userId) return { userId: identity.userId, via: "greenhaven_id" }
  }

  // Pi username
  if (input.startsWith("@") || (!input.includes("-") && input.length >= 3 && input.length <= 32)) {
    const byUser = await getByPiUsername(input)
    if (byUser?.ghUserId) return { userId: byUser.ghUserId, via: "pi_username" }
  }

  // Pi app uid
  const byPi = await getByPiAppUid(input)
  if (byPi?.ghUserId) return { userId: byPi.ghUserId, via: "pi_app_uid" }

  // Internal GH user id already in pi map
  const byGh = await getByGhUserId(input)
  if (byGh?.ghUserId) return { userId: byGh.ghUserId, via: "gh_user_id" }

  return { userId: null, via: "unresolved" }
}

/** POST — attribute the authenticated user to a referral code OR identity key (once) */
export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const parsedBody = await readBoundedJson(request, 16 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 })
  const raw = parsedBody.value
  const parsed = z
    .object({
      code: z.string().min(2).max(64).optional(),
      greenHavenId: z.string().min(2).max(64).optional(),
      referrerGreenHavenId: z.string().min(2).max(64).optional(),
      /** Accept Pi username / uid / GH user id under any of these keys */
      referrerKey: z.string().min(2).max(64).optional(),
      piUsername: z.string().min(2).max(64).optional(),
    })
    .safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 })
  }

  let code = (parsed.data.code || "").trim()
  const key =
    (parsed.data.greenHavenId ||
      parsed.data.referrerGreenHavenId ||
      parsed.data.referrerKey ||
      parsed.data.piUsername ||
      "").trim()

  if (!code && key) {
    // If key looks like a short referral code (not GH- and not @), try as code first
    const maybeCode = key.toUpperCase().replace(/\s+/g, "")
    if (/^[A-Z0-9]{4,16}$/.test(maybeCode) && !maybeCode.startsWith("GH")) {
      // Try attribute path via ensure later — use as code
      code = maybeCode
    } else {
      const resolved = await resolveReferrerUserId(key)
      if (!resolved.userId) {
        return NextResponse.json(
          {
            ok: false,
            error: "INVALID_REFERRER",
            message:
              "Could not find that referrer. Use their invite code, GreenHaven ID (GH-……), or exact Pi username.",
          },
          { status: 400 },
        )
      }
      if (resolved.userId === auth.userId) {
        return NextResponse.json({ ok: false, error: "SELF_REFERRAL" }, { status: 400 })
      }
      const ensured = await ensureReferralCode(resolved.userId)
      if (!ensured.ok || !ensured.code) {
        return NextResponse.json({ ok: false, error: "REFERRER_CODE_UNAVAILABLE" }, { status: 503 })
      }
      code = ensured.code
    }
  }
  if (!code) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_BODY",
        message: "Provide an invite code, GreenHaven ID (GH-……), or Pi username.",
      },
      { status: 400 },
    )
  }

  const result = await attributeReferral(auth.userId, code)
  if (!result.ok) {
    // If code path failed and we still have a key, try identity resolution once
    if (result.error === "INVALID_CODE" && key) {
      const resolved = await resolveReferrerUserId(key)
      if (resolved.userId && resolved.userId !== auth.userId) {
        const ensured = await ensureReferralCode(resolved.userId)
        if (ensured.ok && ensured.code) {
          const retry = await attributeReferral(auth.userId, ensured.code)
          if (retry.ok) {
            return NextResponse.json({
              ok: true,
              idempotent: retry.idempotent,
              message: retry.idempotent
                ? "Referral already recorded."
                : "Referral locked in — GHC rewards accrue when settlement is enabled.",
            })
          }
        }
      }
    }
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
              ? "That invite code, GreenHaven ID, or Pi username was not found."
              : undefined,
      },
      { status },
    )
  }
  return NextResponse.json({
    ok: true,
    idempotent: result.idempotent,
    message: result.idempotent
      ? "Referral already recorded."
      : "Referral locked in — GHC rewards accrue when settlement is enabled.",
  })
}
