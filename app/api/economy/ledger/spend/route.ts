/**
 * POST /api/economy/ledger/spend — membership, marketplace, boosts.
 * Decreases available GHC only after server validation.
 */
/** GHC ledger only — never accept Pi amounts (see lib/asset-separation.ts) */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import {
  executeAuthoritativeSpend,
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

  const amount = Number(body.amount)
  const referenceId = String(body.referenceId || "").trim()
  const reason = String(body.reason || "Purchase").trim()
  const sourceEvent = body.sourceEvent != null ? String(body.sourceEvent) : "SPEND"
  const kind = (body.kind as "spent" | "purchased" | undefined) || "spent"

  if (!referenceId) return jsonErr("INVALID_INPUT", "referenceId required", 400)
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonErr("INVALID_AMOUNT", "amount must be > 0", 400)
  }

  if (isDatabaseConfigured()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Spend RPC migration pending — enable GHC_SERVER_MEMORY or apply ledger spend migration",
      503
    )
  }

  if (!allowMemoryServer()) {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative spend requires database or GHC_SERVER_MEMORY=1", 503)
  }

  const result = await executeAuthoritativeSpend(getProcessGhcStore(), {
    userId: auth.userId,
    amount,
    referenceId,
    reason,
    sourceEvent,
    kind,
  })
  if (!result.ok) {
    const status = result.error === "INSUFFICIENT_BALANCE" ? 402 : 400
    return jsonErr(result.error, result.error, status)
  }

  return jsonOk({
    ok: true,
    idempotent: result.idempotent,
    transaction: result.tx,
  })
}
