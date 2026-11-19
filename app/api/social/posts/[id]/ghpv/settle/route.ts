/**
 * POST /api/social/posts/[id]/ghpv/settle
 * SYSTEM OPERATION — not a user action.
 *
 * Requires header x-gh-settlement-key matching GH_SETTLEMENT_INTERNAL_KEY.
 * Ordinary authenticated users cannot invoke settlement.
 * Client cannot supply votes, reviewer ids, power, JCS, epoch, or outcome.
 * Does not mint GHC. Not called from the vote path.
 * Production cron is intentionally not configured in this phase.
 */
import { NextResponse } from "next/server"
import { operatorKeyAuthorized, OPERATOR_KEY_MIN_BYTES } from "@/lib/server/security/operator-key"
import { settleContentEpoch, settlementEpochFor } from "@/lib/server/ghpv/settle-service"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorized(request: Request): boolean {
  return operatorKeyAuthorized(request, {
    headers: ["x-gh-settlement-key"],
    envNames: ["GH_SETTLEMENT_INTERNAL_KEY"],
    minBytes: OPERATOR_KEY_MIN_BYTES,
  })
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!process.env.GH_SETTLEMENT_INTERNAL_KEY) {
    return NextResponse.json(
      { ok: false, error: "SETTLEMENT_DISABLED", ghcMutated: false },
      { status: 503 }
    )
  }
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  const { id } = await ctx.params
  const postId = String(id || "").trim()
  if (!postId || postId.length > 128) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  }
  const rateLimit = await checkDurableRateLimit(`ghpv-settlement:${postId}`, 2, 60_000, { onUnavailable: "deny" })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, error: durableRateLimitCode(rateLimit), ghcMutated: false },
      { status: durableRateLimitStatus(rateLimit), headers: { "Cache-Control": "no-store" } },
    )
  }
  // Ignore any client body. Epoch is server-derived.
  const result = await settleContentEpoch({
    contentId: postId,
    settlementEpoch: settlementEpochFor(),
  })
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 503
    return NextResponse.json(result, { status })
  }
  return NextResponse.json(result)
}
