/**
 * POST /api/economy/rewards/daily
 *
 * Server-authoritative daily check-in claim pipeline:
 *   auth → evaluate DAILY_CHECKIN (server amount) → claim hold → response
 *
 * Client may send rewardDayKey for idempotency reference only.
 * Client amount is ignored.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { evaluateRewardAuthoritative } from "@/lib/server/economy/reward-engine"
import {
  executeAuthoritativeClaimPending,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { rpcClaimPending } from "@/lib/server/economy/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const dayKey =
    String(body.rewardDayKey || body.dayKey || "").trim() ||
    new Date().toISOString().slice(0, 10)
  const referenceId = `daily_checkin:${auth.userId}:${dayKey}`

  // Reject client-dictated amounts explicitly
  if (body.amount != null || body.ghc != null) {
    // Still process — but never use those fields for credit size
  }

  if (!allowMemoryServer() && !isDatabaseConfigured()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Authoritative daily rewards require GHC_SERVER_MEMORY=1 or a configured database",
      503
    )
  }

  const evaluated = await evaluateRewardAuthoritative({
    userId: auth.userId,
    sourceEvent: "DAILY_CHECKIN",
    referenceId,
    metadata: {
      cycleDay: body.cycleDay != null ? Number(body.cycleDay) : undefined,
    },
  })

  if (!evaluated.ok) {
    const code = evaluated.error || "NOT_ELIGIBLE"
    if (code.includes("DUPLICATE") || code.includes("ALREADY") || code.includes("LIMIT")) {
      return jsonErr(code, evaluated.deniedReasons?.join(", ") || code, 409)
    }
    return jsonErr(code, evaluated.deniedReasons?.join(", ") || code, 400)
  }

  const holdId = evaluated.holdId
  if (isDatabaseConfigured()) {
    const result = await rpcClaimPending(auth.userId, holdId)
    if (!result.ok) {
      return jsonOk({
        ok: true,
        pending: true,
        holdId,
        amount: evaluated.amount,
        message: "Reward staged; claim pending validation",
      })
    }
    return jsonOk({
      ok: true,
      amount: result.amount ?? evaluated.amount,
      transactionId: result.transactionId,
      holdId,
      referenceId,
    })
  }

  const claim = await executeAuthoritativeClaimPending(getProcessGhcStore(), {
    userId: auth.userId,
    holdId,
  })
  if (!claim.ok) {
    return jsonOk({
      ok: true,
      pending: true,
      holdId,
      amount: evaluated.amount,
      message: "Reward staged",
    })
  }

  return jsonOk({
    ok: true,
    amount: claim.amount ?? evaluated.amount,
    transactionId: claim.tx?.id,
    holdId,
    referenceId,
    alreadyClaimed: claim.alreadyClaimed,
  })
}
