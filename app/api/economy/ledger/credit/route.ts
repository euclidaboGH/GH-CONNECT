/**
 * POST /api/economy/ledger/credit — server-only promotional / admin credit.
 * Not for client-invented rewards; requires auth. Future: admin role gate.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import {
  executeAuthoritativeCredit,
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
  const reason = String(body.reason || "Credit").trim()
  const sourceEvent = body.sourceEvent != null ? String(body.sourceEvent) : "ADJUSTED"
  // Clients may only request credits for their own userId
  const targetUserId = String(body.userId || auth.userId).trim()
  if (targetUserId !== auth.userId) {
    return jsonErr("FORBIDDEN", "Cannot credit another user from this endpoint", 403)
  }

  if (!referenceId) return jsonErr("INVALID_INPUT", "referenceId required", 400)
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonErr("INVALID_AMOUNT", "amount must be > 0", 400)
  }
  if (amount > 50_000) return jsonErr("INVALID_AMOUNT", "amount exceeds server limit", 400)

  if (isDatabaseConfigured()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Credit RPC migration pending — enable GHC_SERVER_MEMORY or apply ledger credit migration",
      503
    )
  }

  if (!allowMemoryServer()) {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative credit requires database or GHC_SERVER_MEMORY=1", 503)
  }

  const result = await executeAuthoritativeCredit(getProcessGhcStore(), {
    userId: auth.userId,
    amount,
    referenceId,
    reason,
    sourceEvent,
    kind: "adjusted",
  })
  if (!result.ok) return jsonErr(result.error, result.error, 400)

  return jsonOk({
    ok: true,
    idempotent: result.idempotent,
    transaction: result.tx,
  })
}
