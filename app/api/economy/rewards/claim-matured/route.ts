/**
 * POST /api/economy/rewards/claim-matured
 * Reconciles only authenticated user's matured Daily Claim V12 holds.
 * The database RPC enforces ownership, the 48-hour lock, review status and idempotency.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { rpcClaimPending, rpcListMaturedDailyClaimHolds, rpcWalletSnapshot } from "@/lib/server/economy/db"
import { isDatabaseConfigured, jsonErr, jsonOk } from "@/lib/server/economy/http"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LOCK_MS = 48 * 60 * 60 * 1000

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)
  if (!isDatabaseConfigured()) return jsonErr("DATABASE_UNAVAILABLE", "Durable wallet database is required to reconcile matured rewards", 503)

  pruneRateLimitBuckets()
  const rate = checkRateLimit(`claim_matured:${auth.userId}`, 6, 60_000)
  if (!rate.ok) return jsonErr("RATE_LIMITED", `Too many wallet reconciliation attempts; retry in ${rate.retryAfterSec}s`, 429)

  const cutoff = new Date(Date.now() - LOCK_MS)
  const candidates = await rpcListMaturedDailyClaimHolds(auth.userId, cutoff)
  if (!candidates) return jsonErr("WALLET_UNAVAILABLE", "Could not read your durable reward ledger", 503)
  const eligible = candidates.filter((tx) => {
    const metadata = tx.metadata || {}
    return metadata.reviewRequired !== true && metadata.reviewRequired !== "true"
  }).slice(0, 25)

  let settledCount = 0
  let settledAmount = 0
  let skippedCount = 0
  for (const tx of eligible) {
    const result = await rpcClaimPending(auth.userId, tx.id)
    if (result.ok) {
      if (!result.alreadyClaimed) {
        settledCount += 1
        settledAmount += Number(result.amount || 0)
      }
    } else {
      // Fail closed on legacy/malformed metadata and database errors. The next
      // reconciliation can retry once the record is repaired or service recovers.
      skippedCount += 1
    }
  }

  const wallet = await rpcWalletSnapshot(auth.userId)
  if (!wallet) return jsonErr("WALLET_UNAVAILABLE", "Rewards were reconciled but the wallet snapshot could not be refreshed", 503)
  return jsonOk({
    ok: true,
    examined: candidates.length,
    settledCount,
    settledAmount: Number(settledAmount.toFixed(4)),
    skippedCount,
    wallet: { available: wallet.balance, pending: wallet.pending, locked: wallet.locked, ledgerBalance: wallet.ledgerBalance },
  }, 200, { headers: { "Cache-Control": "no-store, max-age=0" } })
}
