/**
 * POST /api/economy/rewards/claim — claim pending GHC to available balance.
 * Body: { holdId: string }
 * Server RPC is authoritative when DB configured; otherwise client local claim remains.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { rpcClaimPending } from "@/lib/server/economy/db"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { getProcessGhcStore } from "@/lib/server/economy/store"

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
      return jsonErr(code, code === "UNDER_REVIEW" ? "This credit is under review" : "Not claimable", status)
    }
    return jsonOk({
      ok: true,
      alreadyClaimed: result.alreadyClaimed,
      transactionId: result.transactionId,
      amount: result.amount,
    })
  }

  if (allowMemoryServer()) {
    // Studio memory: mark claim via process store if present
    try {
      const store = getProcessGhcStore()
      // Best-effort: no second ledger — client still owns Studio claim via EconomyDomain
      void store
    } catch {
      /* */
    }
    return jsonOk({
      ok: true,
      mode: "local",
      message: "Use client EconomyDomain.claimReward in Studio when DB is not configured",
      holdId,
    })
  }

  return jsonErr("SERVER_UNAVAILABLE", "Database not configured", 503)
}
