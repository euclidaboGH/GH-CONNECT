/**
 * POST /api/economy/rewards/claim — claim pending GHC to available balance.
 * Body: { holdId: string }
 * Server is authoritative when DB or memory server is configured.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { rpcClaimPending } from "@/lib/server/economy/db"
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

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("INVALID_INPUT", "Invalid JSON body", 400)
  }
  const holdId = String(body.holdId || body.rewardId || "").trim()
  if (!holdId) return jsonErr("INVALID_INPUT", "holdId required", 400)

  if (isDatabaseConfigured()) {
    const result = await rpcClaimPending(auth.userId, holdId)
    if (!result.ok) {
      const code = result.error || "NOT_CLAIMABLE"
      const status =
        code === "UNDER_REVIEW" ? 403 : code === "NOT_CLAIMABLE" ? 404 : 400
      return jsonErr(
        code,
        code === "UNDER_REVIEW" ? "This credit is under review" : "Not claimable",
        status
      )
    }
    return jsonOk({
      ok: true,
      alreadyClaimed: result.alreadyClaimed,
      transactionId: result.transactionId,
      amount: result.amount,
    })
  }

  if (allowMemoryServer()) {
    const result = await executeAuthoritativeClaimPending(getProcessGhcStore(), {
      userId: auth.userId,
      holdId,
    })
    if (!result.ok) return jsonErr(result.error, result.error, 404)
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
