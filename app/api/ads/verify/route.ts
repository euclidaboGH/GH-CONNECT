/**
 * POST /api/ads/verify — Pi rewarded-ad verification gate.
 *
 * VERIFY FIRST → REWARD ONLY AFTER AUTHORITATIVE VERIFICATION
 * This phase NEVER grants GHC/Pi/wallet credit.
 * Client adId is a request signal only — not proof of completion.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { recordAdVerificationAttempt } from "@/lib/server/ads/verify-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`ads-verify:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, verified: false, rewardAuthorized: false, error: "RATE_LIMITED" },
      { status: 429 }
    )
  }

  let body: {
    adId?: string
    placement?: string
    userId?: string
    rewardAmount?: number
    verified?: boolean
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const adId = String(body.adId || "").trim().slice(0, 200)
  if (!adId) {
    return NextResponse.json(
      { ok: false, verified: false, rewardAuthorized: false, error: "MISSING_AD_ID" },
      { status: 400 }
    )
  }

  const placement =
    body.placement === "interstitial" || body.placement === "rewarded"
      ? body.placement
      : "rewarded"

  const idempotencyKey = `ad_verify:${auth.userId}:${adId}`

  const enabled = String(process.env.GH_ADS_ENABLED || "").toLowerCase() === "true"
  if (!enabled) {
    await recordAdVerificationAttempt({
      userId: auth.userId,
      adId,
      idempotencyKey,
      placement,
      status: "disabled",
      rejectReason: "ADS_NOT_ENABLED",
    }).catch(() => null)

    return NextResponse.json(
      {
        ok: false,
        verified: false,
        rewardAuthorized: false,
        rewarded: false,
        error: "ADS_NOT_ENABLED",
        message:
          "Pi Ad Network verification is disabled. Client signals are not proof of reward eligibility.",
      },
      { status: 503 }
    )
  }

  await recordAdVerificationAttempt({
    userId: auth.userId,
    adId,
    idempotencyKey,
    placement,
    status: "rejected",
    rejectReason: "ADS_VERIFY_NOT_IMPLEMENTED",
    metadata: { note: "Provider API integration pending" },
  }).catch(() => null)

  return NextResponse.json(
    {
      ok: false,
      verified: false,
      rewardAuthorized: false,
      rewarded: false,
      error: "ADS_VERIFY_NOT_IMPLEMENTED",
      message:
        "Server-side Pi ad verification is not implemented. No reward authorized.",
    },
    { status: 501 }
  )
}
