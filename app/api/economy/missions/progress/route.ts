/**
 * POST /api/economy/missions/progress
 * Verifies supported missions against durable server records and unlocks a
 * non-financial achievement exactly once. Mission GHC issuance is not enabled.
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialRpc } from "@/lib/server/social/rpc"
import {
  checkDurableRateLimit,
  durableRateLimitCode,
  durableRateLimitStatus,
} from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED = new Set([
  "join_community",
  "first_post",
  "first_comment",
  "meaningful_contribution",
  "complete_profile",
  "send_connection",
  "accept_connection",
])

function response(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}

export async function POST(req: Request) {
  const auth = await resolveAuthenticatedUser(req.headers)
  if (!auth?.userId) {
    return response(401, { ok: false, error: "AUTH_REQUIRED" })
  }

  const rate = await checkDurableRateLimit(`rewards-mission:${auth.userId}`, 8, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) {
    return response(durableRateLimitStatus(rate), {
      ok: false,
      error: durableRateLimitCode(rate),
      message: rate.unavailable
        ? "Mission protection is temporarily unavailable. Please retry shortly."
        : `Too many mission attempts. Retry in ${rate.retryAfterSec}s.`,
    })
  }

  const parsed = await readBoundedJson(req, 4096)
  if (!parsed.ok) {
    const tooLarge = parsed.error === "REQUEST_TOO_LARGE"
    return response(tooLarge ? 413 : 400, {
      ok: false,
      error: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_INPUT",
    })
  }

  const code = typeof parsed.value.code === "string"
    ? parsed.value.code.trim().toLowerCase()
    : ""
  if (!ALLOWED.has(code)) {
    return response(400, { ok: false, error: "INVALID_MISSION" })
  }

  // Client metadata is deliberately ignored. Identity and proof are server-derived.
  void parsed.value.meta
  const result = await socialRpc("gh_rewards_mission_complete", {
    p_user_id: auth.userId,
    p_code: code,
  })
  if (!result.ok) {
    return response(503, {
      ok: false,
      completed: false,
      verified: false,
      grantedGhc: 0,
      error: "MISSION_VERIFICATION_UNAVAILABLE",
      message: "Mission verification is temporarily unavailable. No reward was issued.",
    })
  }

  const data = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : null
  if (!data || data.ok !== true) {
    return response(503, {
      ok: false,
      completed: false,
      verified: false,
      grantedGhc: 0,
      error: "MISSION_VERIFICATION_UNAVAILABLE",
      message: "The mission verification service did not return a valid result. No reward was issued.",
    })
  }

  return response(200, {
    ok: true,
    completed: data.completed === true,
    verified: data.verified === true,
    alreadyCompleted: data.alreadyCompleted === true,
    achievementId: typeof data.achievementId === "string" ? data.achievementId : undefined,
    grantedGhc: 0,
    rewardStatus: data.rewardStatus === "achievement_only" ? "achievement_only" : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
    message: typeof data.message === "string"
      ? data.message
      : "Mission status checked against GreenHaven records.",
  })
}
