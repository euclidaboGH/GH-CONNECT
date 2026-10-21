/**
 * POST /api/economy/utility — purchase a catalog utility sink with GHC.
 * Body: { purpose, targetId?, clientRequestId? }
 * Amount always from server catalog. Idempotent on referenceId.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"
import { getCatalogEntry, resolveSpendAmount } from "@/lib/server/economy/spend-catalog"
import {
  executeAuthoritativeSpend,
  executeDurableGhcSpend,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import { recordTelemetryEvent } from "@/lib/server/economy/telemetry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UTILITY = new Set([
  "boost",
  "boost_post",
  "boost_profile",
  "boost_listing",
  "feed_spotlight",
  "community_tools_month",
  "creator_studio_day",
])

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`utility:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return jsonErr("RATE_LIMITED", `Too many utility purchases; retry in ${rl.retryAfterSec}s`, 429)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("INVALID_INPUT", "Invalid JSON", 400)
  }

  void body.amount
  void body.balance
  void body.userId

  const purpose = String(body.purpose || "").trim().toLowerCase()
  if (!UTILITY.has(purpose)) {
    return jsonErr("INVALID_PURPOSE", "Not a utility sink purpose", 400)
  }

  const resolved = resolveSpendAmount(purpose, 0)
  if (!resolved.ok) {
    return jsonErr(resolved.error, "Catalog resolve failed", 400)
  }

  const targetId = String(body.targetId || body.postId || body.listingId || body.profileId || "").trim()
  const clientReq = String(body.clientRequestId || body.idempotencyKey || "").trim()
  const referenceId =
    clientReq ||
    `utility:${purpose}:${auth.userId}:${targetId || "none"}:${Math.floor(Date.now() / 60000)}`

  const entry = getCatalogEntry(purpose)!
  const reason = entry.description
  const sourceEvent = `UTILITY_${purpose.toUpperCase()}`

  let spendOk = false
  let spendError = "SPEND_FAILED"
  let txId: string | undefined
  let idempotent = false

  if (isDatabaseConfigured()) {
    const spend = await executeDurableGhcSpend({
      userId: auth.userId,
      amount: resolved.amount,
      referenceId,
      reason,
      sourceEvent,
    })
    if (spend.ok) {
      spendOk = true
      idempotent = Boolean(spend.idempotent)
      if (spend.tx && typeof spend.tx === "object" && "id" in spend.tx) {
        txId = String((spend.tx as { id: string }).id)
      }
    } else {
      spendError = spend.error || "SPEND_FAILED"
    }
  } else if (allowMemoryServer()) {
    const spend = await executeAuthoritativeSpend(getProcessGhcStore(), {
      userId: auth.userId,
      amount: resolved.amount,
      referenceId,
      reason,
      sourceEvent,
    })
    if (spend.ok) {
      spendOk = true
      txId = spend.tx.id
      idempotent = Boolean(spend.idempotent)
    } else {
      spendError = spend.error || "SPEND_FAILED"
    }
  } else {
    return jsonErr("SERVER_UNAVAILABLE", "Economy database not configured", 503)
  }

  if (!spendOk) {
    const status = spendError === "INSUFFICIENT_BALANCE" ? 400 : 503
    return jsonErr(spendError, spendError === "INSUFFICIENT_BALANCE" ? "Insufficient available GHC" : "Spend failed", status)
  }

  try {
    const dayKey = new Date().toISOString().slice(0, 10)
    recordTelemetryEvent({
      type: "sink_boost",
      dayKey,
      eligibleEconomicUsers: 0,
      m: 1,
      g: 1,
      demand: 0,
      budget: 0,
      userIssuance: 0,
      reserveIssuance: 0,
      grossIssuance: 0,
      sinks: resolved.amount,
      netCirculatingChange: -resolved.amount,
      meta: { purpose, userId: auth.userId, targetId: targetId || null },
    })
  } catch {
    /* */
  }

  const expiresAt =
    entry.durationHours && entry.durationHours > 0
      ? new Date(Date.now() + entry.durationHours * 3600 * 1000).toISOString()
      : null

  return jsonOk({
    ok: true,
    purpose,
    amountGhc: resolved.amount,
    targetId: targetId || null,
    referenceId,
    transactionId: txId,
    idempotent,
    expiresAt,
    effect: {
      kind: purpose,
      targetId: targetId || null,
      durationHours: entry.durationHours || null,
      note: "Visibility preference is recorded with the spend; ranking systems may honor active boosts when present.",
    },
  })
}
