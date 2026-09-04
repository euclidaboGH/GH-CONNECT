/**
 * POST /api/economy/ledger/credit — privileged promotional / admin credit only.
 *
 * Ordinary users cannot mint GHC here.
 * Requires header: x-ghc-admin-credit-key matching env GHC_ADMIN_CREDIT_KEY.
 * Client-supplied amounts are still capped; referenceId is required for idempotency.
 *
 * This is NOT an activity or daily-claim path. Do not use for ordinary rewards.
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

/** Hard ceiling for a single admin credit (micro-abuse brake) */
const MAX_ADMIN_CREDIT = 1_000

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const adminKey = process.env.GHC_ADMIN_CREDIT_KEY || ""
  const provided = request.headers.get("x-ghc-admin-credit-key") || ""
  if (!adminKey || provided !== adminKey) {
    return jsonErr(
      "FORBIDDEN",
      "Admin credit requires GHC_ADMIN_CREDIT_KEY; ordinary users cannot mint GHC",
      403
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("INVALID_INPUT", "Invalid JSON body", 400)
  }

  const amount = Number(body.amount)
  const referenceId = String(body.referenceId || "").trim()
  const reason = String(body.reason || "Admin credit").trim()
  const sourceEvent =
    body.sourceEvent != null ? String(body.sourceEvent) : "ADMIN_ADJUSTED"
  const targetUserId = String(body.userId || auth.userId).trim()

  if (!referenceId) return jsonErr("INVALID_INPUT", "referenceId required", 400)
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonErr("INVALID_AMOUNT", "amount must be > 0", 400)
  }
  if (amount > MAX_ADMIN_CREDIT) {
    return jsonErr("INVALID_AMOUNT", `amount exceeds admin credit limit (${MAX_ADMIN_CREDIT})`, 400)
  }

  if (isDatabaseConfigured()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Admin credit RPC for DB path not enabled in this revision — use controlled ops process",
      503
    )
  }

  if (!allowMemoryServer()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Authoritative credit requires database or GHC_SERVER_MEMORY=1",
      503
    )
  }

  const result = await executeAuthoritativeCredit(getProcessGhcStore(), {
    userId: targetUserId,
    amount,
    referenceId,
    reason: `[admin:${auth.userId}] ${reason}`,
    sourceEvent,
    kind: "adjusted",
  })
  if (!result.ok) return jsonErr(result.error, result.error, 400)

  return jsonOk({
    ok: true,
    idempotent: result.idempotent,
    transaction: result.tx,
    channel: "admin_credit",
  })
}
