/**
 * POST /api/economy/ledger/spend — membership, marketplace, boosts.
 *
 * Amount is server-authoritative for catalog purposes (boost, VIP, VVIP).
 * Client amount is ignored for fixed purposes; mismatches rejected.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"
import { resolveSpendAmount } from "@/lib/server/economy/spend-catalog"
import {
  executeAuthoritativeSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`spend:${auth.userId}`, 20, 60_000)
  if (!rl.ok) {
    return jsonErr("RATE_LIMITED", `Too many spend attempts; retry in ${rl.retryAfterSec}s`, 429)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("INVALID_INPUT", "Invalid JSON body", 400)
  }

  const purpose = String(body.purpose || body.sourceEvent || "").trim()
  const clientAmount = Number(body.amount)
  const referenceId = String(body.referenceId || "").trim()
  const reason = String(body.reason || "Purchase").trim()
  const kind = (body.kind as "spent" | "purchased" | undefined) || "spent"

  if (!referenceId) return jsonErr("INVALID_INPUT", "referenceId required", 400)

  const resolved = resolveSpendAmount(purpose, clientAmount)
  if (!resolved.ok) {
    return jsonErr(resolved.error, resolved.error, 400)
  }

  if (isDatabaseConfigured()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Spend RPC migration pending — enable GHC_SERVER_MEMORY or apply ledger spend migration",
      503
    )
  }

  if (!allowMemoryServer()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Authoritative spend requires database or GHC_SERVER_MEMORY=1",
      503
    )
  }

  const result = await executeAuthoritativeSpend(getProcessGhcStore(), {
    userId: auth.userId,
    amount: resolved.amount,
    referenceId,
    reason: reason || resolved.entry.description,
    sourceEvent: resolved.entry.purpose,
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
    amount: resolved.amount,
    purpose: resolved.entry.purpose,
    baseGhc: resolved.entry.baseGhc,
    feeGhc: resolved.entry.feeGhc,
  })
}
