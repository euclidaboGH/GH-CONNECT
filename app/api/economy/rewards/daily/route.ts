/**
 * POST /api/economy/rewards/daily
 *
 * ECONOMY_VERSION 1.2 — atomic Daily Claim path:
 *   auth → server compute (m,g,80/20) → pending entitlement + streak in one DB transaction.
 *   The pending entitlement becomes redeemable after 48 hours; it is not spendable yet.
 *
 * Client amounts are ignored. Double-submit returns existing success (idempotent).
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { computeDailyClaim, lagosDayKey, lagosYesterdayKey, loadClaimStreakState } from "@/lib/server/economy/claim-engine"
import { ECONOMY_VERSION } from "@/lib/server/economy/economic-config"
import { rpcExecuteDailyClaimV12 } from "@/lib/server/economy/db"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import {
  executeAuthoritativePending,
  getProcessGhcStore,
} from "@/lib/server/economy/store"
import {
  applyNetworkEmission,
  getCurrentDayDemand,
  getEligibleEconomicUsers,
  recordEmissionDemand,
} from "@/lib/server/economy/network-scarcity"
import { recordTelemetryEvent } from "@/lib/server/economy/telemetry"
import {
  commitDailyClaimState,
} from "@/lib/server/economy/claim-engine"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


/** GET /api/economy/rewards/daily — durable, read-only claim availability. */
export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  if (!isDatabaseConfigured() && !allowMemoryServer()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Daily reward status requires the durable economy database to be configured.",
      503
    )
  }

  try {
    const state = await loadClaimStreakState(auth.userId)
    const today = lagosDayKey()
    const yesterday = lagosYesterdayKey()
    const claimedToday = state.lastClaimDayKey === today
    let cycleDay = 1
    if (claimedToday) {
      cycleDay = Math.max(1, Math.min(7, state.cycleDay || 1))
    } else if (state.lastClaimDayKey === yesterday) {
      cycleDay = state.cycleDay >= 7 ? 1 : Math.max(1, state.cycleDay + 1)
    }

    return jsonOk({
      ok: true,
      dayKey: today,
      lastClaimDayKey: state.lastClaimDayKey,
      claimedToday,
      claimable: !claimedToday,
      cycleDay,
      completedCycles: state.completedCycles,
      totalSuccessfulClaims: state.totalSuccessfulClaims,
      economicVersion: state.economicVersion,
    }, 200, { headers: { "Cache-Control": "no-store, max-age=0" } })
  } catch {
    return jsonErr("SERVER_UNAVAILABLE", "Could not load daily reward status. Retry shortly.", 503)
  }
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  pruneRateLimitBuckets()
  const rl = checkRateLimit(`daily_claim:${auth.userId}`, 10, 60_000)
  if (!rl.ok) {
    return jsonErr("RATE_LIMITED", `Too many claim attempts; retry in ${rl.retryAfterSec}s`, 429)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  // Explicitly ignore client-dictated economic values
  void body.amount
  void body.ghc
  void body.userAmount
  void body.reserveAmount
  void body.cycleDay
  void body.m
  void body.g

  if (!isDatabaseConfigured() && !allowMemoryServer()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "GHC daily rewards require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY with ghc_execute_daily_claim_v12 applied. In-memory claims are disabled on this deployment.",
      503
    )
  }

  const computed = await computeDailyClaim({ userId: auth.userId })
  if (!computed.ok) {
    if (computed.error === "ALREADY_CLAIMED_TODAY") {
      // Idempotent response: a repeated tap must not look like a failed claim.
      return jsonOk({
        ok: true,
        amount: 0,
        alreadyClaimed: true,
        idempotent: true,
        cycleDay: computed.cycleDay,
        dayKey: computed.dayKey,
        economicVersion: ECONOMY_VERSION,
      })
    }
    const status = computed.error === "SERVER_UNAVAILABLE" ? 503 : 400
    return jsonErr(computed.error, computed.error, status)
  }

  const completedCyclesForCommit =
    computed.cycleDay >= 7
      ? computed.completedCycles + 1
      : computed.completedCycles

  // ---------- Production / DB: single transactional RPC ----------
  if (isDatabaseConfigured()) {
    const atomic = await rpcExecuteDailyClaimV12({
      userId: auth.userId,
      claimDayKey: computed.dayKey,
      cycleDay: computed.cycleDay,
      completedCycles: completedCyclesForCommit,
      idempotencyKey: computed.idempotencyKey,
      grossAmount: computed.grossGhc,
      userAmount: computed.userGhc,
      reserveAmount: computed.reserveGhc,
      baseGross: computed.baseGross,
      m: computed.m,
      g: computed.g,
      economicVersion: ECONOMY_VERSION,
      missedDayReset: computed.missedDayReset,
    })

    if (!atomic.ok) {
      const status =
        atomic.error === "SERVER_UNAVAILABLE" ? 503 : 400
      return jsonErr(atomic.error || "CLAIM_FAILED", atomic.error || "CLAIM_FAILED", status)
    }
    // Fail closed if the database has not yet been upgraded to the 48-hour
    // pending-claim contract. Never tell users a posted legacy credit is locked.
    if (atomic.pending !== true || !atomic.redeemableAt) {
      return jsonErr(
        "GHC_DAILY_CLAIM_MIGRATION_REQUIRED",
        "Daily rewards are temporarily unavailable while the 48-hour claim migration is verified.",
        503
      )
    }

    recordEmissionDemand(computed.dayKey, computed.baseGross * computed.m)
    recordTelemetryEvent({
      type: "daily_claim",
      dayKey: computed.dayKey,
      eligibleEconomicUsers: getEligibleEconomicUsers(),
      m: atomic.m ?? computed.m,
      g: atomic.g ?? computed.g,
      demand: getCurrentDayDemand(computed.dayKey),
      budget: applyNetworkEmission(0, getEligibleEconomicUsers(), 0).budget,
      userIssuance: atomic.userAmount ?? computed.userGhc,
      reserveIssuance: atomic.reserveAmount ?? computed.reserveGhc,
      grossIssuance: atomic.grossAmount ?? computed.grossGhc,
      sinks: 0,
      netCirculatingChange: 0, // pending entitlements do not enter circulating/spendable balance yet
      meta: {
        userId: auth.userId,
        cycleDay: atomic.cycleDay ?? computed.cycleDay,
        alreadyClaimed: atomic.alreadyClaimed,
        pending: true,
        redeemableAt: atomic.redeemableAt,
        transactionId: atomic.transactionId,
        economicVersion: ECONOMY_VERSION,
        streakBackend: "database_atomic",
      },
    })

    return jsonOk({
      ok: true,
      amount: atomic.userAmount ?? computed.userGhc,
      pending: true,
      redeemableAt: atomic.redeemableAt,
      reserve: atomic.reserveAmount ?? computed.reserveGhc,
      gross: atomic.grossAmount ?? computed.grossGhc,
      baseGross: atomic.baseGross ?? computed.baseGross,
      cycleDay: atomic.cycleDay ?? computed.cycleDay,
      completedCycles: atomic.completedCycles ?? completedCyclesForCommit,
      m: atomic.m ?? computed.m,
      g: atomic.g ?? computed.g,
      missedDayReset: atomic.missedDayReset ?? computed.missedDayReset,
      economicVersion: atomic.economicVersion ?? ECONOMY_VERSION,
      transactionId: atomic.transactionId,
      holdId: atomic.transactionId,
      reserveTransactionId: atomic.reserveTransactionId,
      referenceId: atomic.referenceId ?? computed.idempotencyKey,
      alreadyClaimed: Boolean(atomic.alreadyClaimed),
      idempotent: Boolean(atomic.idempotent || atomic.alreadyClaimed),
      streakBackend: "database_atomic",
    })
  }

  // ---------- Local development path: pending entitlement first, then streak ----------
  const store = getProcessGhcStore()
  const pending = await executeAuthoritativePending(store, {
    userId: auth.userId,
    amount: computed.userGhc,
    referenceId: computed.idempotencyKey,
    reason: `Daily claim day ${computed.cycleDay}/7 (${ECONOMY_VERSION})`,
    sourceEvent: "DAILY_CLAIM_V12",
  })
  if (!pending.ok) {
    return jsonErr(pending.error || "PENDING_FAILED", pending.error || "PENDING_FAILED", 400)
  }
  if (pending.idempotent) {
    return jsonOk({
      ok: true,
      amount: computed.userGhc,
      pending: true,
      redeemableAt: new Date(pending.tx.createdAt + 48 * 60 * 60 * 1000).toISOString(),
      alreadyClaimed: true,
      idempotent: true,
      economicVersion: ECONOMY_VERSION,
      referenceId: computed.idempotencyKey,
      m: computed.m,
      g: computed.g,
      cycleDay: computed.cycleDay,
      streakBackend: "memory",
    })
  }

  // Daily claims are pending entitlements, not spendable wallet credits.
  // They become redeemable after the server-enforced 48-hour lock.
  const claimTransactionId = pending.tx.id
  const redeemableAt = new Date(pending.tx.createdAt + 48 * 60 * 60 * 1000).toISOString()

  // Streak commits after the pending entitlement is durably recorded.
  const locked = await commitDailyClaimState({
    userId: auth.userId,
    result: computed,
  })
  if (!locked.ok) {
    // Credit exists; streak write failed — safe to retry streak only (idempotent key on credit)
    return jsonOk({
      ok: true,
      amount: computed.userGhc,
      pending: true,
      redeemableAt,
      reserve: computed.reserveGhc,
      gross: computed.grossGhc,
      cycleDay: computed.cycleDay,
      m: computed.m,
      g: computed.g,
      economicVersion: ECONOMY_VERSION,
      transactionId: claimTransactionId,
      referenceId: computed.idempotencyKey,
      alreadyClaimed: false,
      streakBackend: "memory",
      warning: "STREAK_COMMIT_RETRYABLE",
    })
  }

  return jsonOk({
    ok: true,
    amount: computed.userGhc,
    pending: true,
    redeemableAt,
    reserve: computed.reserveGhc,
    gross: computed.grossGhc,
    baseGross: computed.baseGross,
    cycleDay: computed.cycleDay,
    completedCycles: completedCyclesForCommit,
    m: computed.m,
    g: computed.g,
    missedDayReset: computed.missedDayReset,
    economicVersion: ECONOMY_VERSION,
    transactionId: claimTransactionId,
    holdId: pending.tx.id,
    referenceId: computed.idempotencyKey,
    alreadyClaimed: false,
    idempotent: false,
    streakBackend: "memory",
  })
}
