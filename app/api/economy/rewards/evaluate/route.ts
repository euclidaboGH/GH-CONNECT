/**
 * POST /api/economy/rewards/evaluate
 *
 * Server-authoritative reward staging. Client sends the *event*, never the credit:
 *   { sourceEvent, referenceId, targetId?, metadata? }
 *
 * Amount comes from server rule catalog + anti-abuse.
 * Never trust: "I followed 50 people → give me 500 GHC".
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { NextResponse } from "next/server"
import { evaluateRewardAuthoritative } from "@/lib/server/economy/reward-engine"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("INVALID_INPUT", "Invalid JSON body", 400)
  }

  const sourceEvent = String(body.sourceEvent || "").trim()
  const referenceId = String(body.referenceId || "").trim()
  const targetId =
    body.targetId != null
      ? String(body.targetId).trim()
      : body.targetUserId != null
        ? String(body.targetUserId).trim()
        : undefined
  const metadata =
    typeof body.metadata === "object" && body.metadata
      ? (body.metadata as Record<string, unknown>)
      : undefined

  // Explicitly reject client-dictated bulk credits
  const clientAmount = body.amount != null ? Number(body.amount) : undefined
  const bulk = Number(metadata?.count || metadata?.followCount || 0)
  if (bulk > 1) {
    return jsonErr(
      "BULK_NOT_ALLOWED",
      "Each rewarded action must be evaluated once with a unique referenceId",
      400
    )
  }

  if (!sourceEvent) return jsonErr("INVALID_INPUT", "sourceEvent required", 400)
  if (!referenceId) return jsonErr("INVALID_INPUT", "referenceId required", 400)

  if (isDatabaseConfigured() && !allowMemoryServer()) {
    // DB path: same engine logic once pending RPC exists; memory engine until then
    // Still reject client amount-as-authority
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Reward evaluate requires GHC_SERVER_MEMORY=1 until DB RPC is wired; client amounts are never trusted",
      503
    )
  }

  if (!allowMemoryServer() && !isDatabaseConfigured()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Authoritative rewards require database or GHC_SERVER_MEMORY=1",
      503
    )
  }

  const result = await evaluateRewardAuthoritative({
    userId: auth.userId,
    sourceEvent,
    referenceId,
    targetId,
    metadata,
    clientSuggestedAmount: clientAmount,
  })

  if (!result.ok) {
    const status =
      result.error === "DAILY_CAP" ||
      result.error === "COOLDOWN" ||
      result.error === "TARGET_CAP" ||
      result.error === "ALREADY_REWARDED" ||
      result.error === "ANTI_ABUSE"
        ? 409
        : 400
    return NextResponse.json(
      {
        ok: false,
        code: result.error,
        message: result.error,
        error: result.error,
        deniedReasons: result.deniedReasons || [],
      },
      { status }
    )
  }

  return jsonOk({
    ok: true,
    amount: result.amount,
    ruleId: result.ruleId,
    holdId: result.holdId,
    requiresValidation: result.requiresValidation,
    idempotent: result.idempotent,
    transaction: result.transaction,
    /** Client-suggested amount is recorded for audit only — never applied */
    clientSuggestedAmountIgnored: clientAmount,
  })
}
