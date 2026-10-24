/**
 * GET /api/referral/status — caller's code, attribution, invite counts, reward tallies.
 * Does not invent balances; settlement still gated by GHC_REFERRAL_SETTLEMENT_ENABLED.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getReferralStatus } from "@/lib/server/referral/referral-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const status = await getReferralStatus(auth.userId)
  if (!status.ok) {
    return NextResponse.json(
      { ok: false, error: status.error || "STATUS_FAILED" },
      { status: status.error === "DB_UNAVAILABLE" ? 503 : 500 },
    )
  }
  return NextResponse.json({
    ok: true,
    durable: true,
    code: status.code,
    sharePath: status.code ? `/join?ref=${encodeURIComponent(status.code)}` : undefined,
    attributed: status.attributed,
    referrerUserId: status.referrerUserId,
    invitedCount: status.invitedCount ?? 0,
    pendingRewardCount: status.pendingRewardCount ?? 0,
    postedRewardCount: status.postedRewardCount ?? 0,
    pendingRewardGhc: status.pendingRewardGhc ?? 0,
    postedRewardGhc: status.postedRewardGhc ?? 0,
    settlementEnabled: Boolean(status.settlementEnabled),
  })
}
