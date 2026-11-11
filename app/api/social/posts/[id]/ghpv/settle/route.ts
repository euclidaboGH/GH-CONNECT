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
import { timingSafeEqual } from "crypto"
import { settleContentEpoch, settlementEpochFor } from "@/lib/server/ghpv/settle-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorized(request: Request): boolean {
  const expected = process.env.GH_SETTLEMENT_INTERNAL_KEY || ""
  const provided = request.headers.get("x-gh-settlement-key") || ""
  if (!expected || expected.length < 16 || !provided) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
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
