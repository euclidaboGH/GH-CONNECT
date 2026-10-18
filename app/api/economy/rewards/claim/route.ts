/**
 * POST /api/economy/rewards/claim — claim pending GHC to available balance.
 * Body: { holdId: string }
 * Server is authoritative when DB or memory server is configured.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { rpcClaimPending, rpcWalletSnapshot } from "@/lib/server/economy/db"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import {
  executeAuthoritativeClaimPending,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`pending_claim:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return jsonErr("RATE_LIMITED", `Too many claim attempts; retry in ${rl.retryAfterSec}s`, 429)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("INVALID_INPUT", "Invalid JSON body", 400)
  }
  // Claim amount and user are server-derived from hold ownership
  void body.amount
  void body.userId
  void body.balance
  const holdId = String(body.holdId || body.rewardId || "").trim()
  if (!holdId) return jsonErr("INVALID_INPUT", "holdId required", 400)

  if (isDatabaseConfigured()) {
    const result = await rpcClaimPending(auth.userId, holdId)
    if (!result.ok) {
      const code = result.error || "NOT_CLAIMABLE"
      const status =
        code === "UNDER_REVIEW" ? 403 : code === "NOT_CLAIMABLE" ? 404 : code === "NOT_YET_REDEEMABLE" ? 409 : 400
      return jsonErr(
        code,
        code === "UNDER_REVIEW"
          ? "This credit is under review"
          : code === "NOT_YET_REDEEMABLE"
            ? `This daily claim becomes redeemable at ${result.redeemableAt || "the end of its 48-hour lock"}`
            : "Not claimable",
        status
      )
    }
    const wallet = await rpcWalletSnapshot(auth.userId)
    return jsonOk({
      ok: true,
      alreadyClaimed: result.alreadyClaimed,
      transactionId: result.transactionId,
      amount: result.amount,
      redeemableAt: result.redeemableAt,
      wallet,
    })
  }

  if (allowMemoryServer()) {
    const result = await executeAuthoritativeClaimPending(getProcessGhcStore(), {
      userId: auth.userId,
      holdId,
    })
    if (!result.ok) {
      const status = result.error === "NOT_YET_REDEEMABLE" ? 409 : result.error === "SOURCE_NOT_REDEEMABLE" ? 403 : 404
      return jsonErr(result.error, result.error === "NOT_YET_REDEEMABLE" ? "This daily claim is locked for 48 hours after claiming" : result.error, status)
    }
    return jsonOk({
      ok: true,
      alreadyClaimed: result.alreadyClaimed,
      transactionId: result.tx.id,
      amount: result.amount,
      transaction: result.tx,
      mode: "memory",
    })
  }

  return jsonErr("SERVER_UNAVAILABLE", "Database not configured", 503)
}
