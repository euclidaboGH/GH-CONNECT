/**
 * POST /api/economy/rewards/daily
 *
 * ECONOMY_VERSION 1.2 — atomic claim path:
 *   auth → server compute (m,g,80/20) → single DB transaction (ledger + streak)
 *
 * Client amounts are ignored. Double-submit returns existing success (idempotent).
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { computeDailyClaim } from "@/lib/server/economy/claim-engine"
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
  executeAuthoritativeClaimPending,
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

  if (!allowMemoryServer() && !isDatabaseConfigured()) {
    return jsonErr(
      "SERVER_UNAVAILABLE",
      "Authoritative daily rewards require GHC_SERVER_MEMORY=1 or a configured database",
      503
    )
  }

  const computed = await computeDailyClaim({ userId: auth.userId })
  if (!computed.ok) {
    const status = computed.error === "ALREADY_CLAIMED_TODAY" ? 409 : 400
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
      netCirculatingChange: atomic.userAmount ?? computed.userGhc,
      meta: {
        userId: auth.userId,
        cycleDay: atomic.cycleDay ?? computed.cycleDay,
        alreadyClaimed: atomic.alreadyClaimed,
        transactionId: atomic.transactionId,
        economicVersion: ECONOMY_VERSION,
        streakBackend: "database_atomic",
      },
    })

    return jsonOk({
      ok: true,
      amount: atomic.userAmount ?? computed.userGhc,
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
      reserveTransactionId: atomic.reserveTransactionId,
      referenceId: atomic.referenceId ?? computed.idempotencyKey,
      alreadyClaimed: Boolean(atomic.alreadyClaimed),
      idempotent: Boolean(atomic.idempotent || atomic.alreadyClaimed),
      streakBackend: "database_atomic",
    })
  }

  // ---------- Memory studio path: ledger first, then streak (no permanent streak without credit) ----------
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

  const claim = await executeAuthoritativeClaimPending(store, {
    userId: auth.userId,
    holdId: pending.tx.id,
  })
  if (!claim.ok) {
    // Ledger did not post — do NOT consume streak
    return jsonErr("LEDGER_CREDIT_FAILED", "Ledger credit failed; claim not consumed", 500)
  }

  await executeAuthoritativePending(store, {
    userId: "__PROTOCOL_RESERVE__",
    amount: computed.reserveGhc,
    referenceId: `${computed.idempotencyKey}:reserve`,
    reason: `Protocol reserve day ${computed.cycleDay}/7`,
    sourceEvent: "PROTOCOL_RESERVE_V12",
  }).catch(() => null)

  // Streak only after successful ledger credit
  const locked = await commitDailyClaimState({
    userId: auth.userId,
    result: computed,
  })
  if (!locked.ok) {
    // Credit exists; streak write failed — safe to retry streak only (idempotent key on credit)
    return jsonOk({
      ok: true,
      amount: computed.userGhc,
      reserve: computed.reserveGhc,
      gross: computed.grossGhc,
      cycleDay: computed.cycleDay,
      m: computed.m,
      g: computed.g,
      economicVersion: ECONOMY_VERSION,
      transactionId: claim.tx?.id,
      referenceId: computed.idempotencyKey,
      alreadyClaimed: false,
      streakBackend: "memory",
      warning: "STREAK_COMMIT_RETRYABLE",
    })
  }

  return jsonOk({
    ok: true,
    amount: computed.userGhc,
    reserve: computed.reserveGhc,
    gross: computed.grossGhc,
    baseGross: computed.baseGross,
    cycleDay: computed.cycleDay,
    completedCycles: completedCyclesForCommit,
    m: computed.m,
    g: computed.g,
    missedDayReset: computed.missedDayReset,
    economicVersion: ECONOMY_VERSION,
    transactionId: claim.tx?.id,
    holdId: pending.tx.id,
    referenceId: computed.idempotencyKey,
    alreadyClaimed: Boolean(claim.alreadyClaimed),
    idempotent: Boolean(claim.alreadyClaimed),
    streakBackend: "memory",
  })
}
