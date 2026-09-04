/**
 * ECONOMY_VERSION 1.2 — Server-authoritative daily claim engine.
 *
 * Browser never submits "give me X GHC".
 * Streak authority: database when configured; memory only for studio without DB.
 * Missed day → reset current 7-day progression only. Never claw back earned GHC.
 */

import {
  CLAIM_GROSS_BY_DAY,
  ECONOMY_VERSION,
  fromMicro,
  getEconomicConfig,
  splitClaimGrossMicro,
  toMicro,
} from "@/lib/server/economy/economic-config"
import {
  applyNetworkEmission,
  cacheEligibleEconomicUsers,
  getCurrentDayDemand,
  getEligibleEconomicUsers,
  recordEmissionDemand,
} from "@/lib/server/economy/network-scarcity"
import { resolveEligibleEconomicUsers } from "@/lib/server/economy/population"
import {
  rpcCommitClaimDay,
  rpcGetClaimStreak,
} from "@/lib/server/economy/db"
import { isDatabaseConfigured } from "@/lib/server/economy/http"
import { recordTelemetryEvent } from "@/lib/server/economy/telemetry"

export type ClaimStreakState = {
  userId: string
  cycleDay: number
  completedCycles: number
  lastClaimDayKey: string | null
  totalSuccessfulClaims: number
  economicVersion: string
  lastIdempotencyKey: string | null
}

/** Memory fallback only when DB is not configured */
const memoryStreakStore = new Map<string, ClaimStreakState>()

export function lagosDayKey(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
}

export function lagosYesterdayKey(d = new Date()): string {
  const today = lagosDayKey(d)
  for (let i = 1; i <= 48; i++) {
    const candidate = new Date(d.getTime() - i * 60 * 60 * 1000)
    const k = lagosDayKey(candidate)
    if (k !== today) return k
  }
  return lagosDayKey(new Date(d.getTime() - 26 * 60 * 60 * 1000))
}

export function getClaimStreakStateMemory(userId: string): ClaimStreakState {
  const existing = memoryStreakStore.get(userId)
  if (existing) return { ...existing }
  return {
    userId,
    cycleDay: 0,
    completedCycles: 0,
    lastClaimDayKey: null,
    totalSuccessfulClaims: 0,
    economicVersion: ECONOMY_VERSION,
    lastIdempotencyKey: null,
  }
}

/** @deprecated use loadClaimStreakState */
export function getClaimStreakState(userId: string): ClaimStreakState {
  return getClaimStreakStateMemory(userId)
}

export function setClaimStreakStateForTests(
  userId: string,
  state: Partial<ClaimStreakState>
): void {
  const cur = getClaimStreakStateMemory(userId)
  memoryStreakStore.set(userId, { ...cur, ...state, userId })
}

export function clearClaimStreakStoreForTests(): void {
  memoryStreakStore.clear()
}

export async function loadClaimStreakState(userId: string): Promise<ClaimStreakState> {
  if (isDatabaseConfigured()) {
    const row = await rpcGetClaimStreak(userId)
    if (row.ok) {
      return {
        userId,
        cycleDay: row.cycleDay,
        completedCycles: row.completedCycles,
        lastClaimDayKey: row.lastClaimDayKey,
        totalSuccessfulClaims: row.totalSuccessfulClaims,
        economicVersion: row.economicVersion || ECONOMY_VERSION,
        lastIdempotencyKey: row.lastIdempotencyKey,
      }
    }
  }
  return getClaimStreakStateMemory(userId)
}

export function baseGrossForCycleDay(cycleDay: number): number {
  const d = Math.min(7, Math.max(1, cycleDay | 0))
  return CLAIM_GROSS_BY_DAY[d - 1] ?? CLAIM_GROSS_BY_DAY[0]
}

export type ClaimComputeResult =
  | {
      ok: true
      alreadyClaimed?: boolean
      cycleDay: number
      completedCycles: number
      baseGross: number
      m: number
      g: number
      grossGhc: number
      userGhc: number
      reserveGhc: number
      userMicro: number
      reserveMicro: number
      dayKey: string
      idempotencyKey: string
      economicVersion: string
      missedDayReset: boolean
    }
  | {
      ok: false
      error: string
      cycleDay: number
      dayKey: string
    }

/**
 * Pure eligibility + amount computation given streak state.
 */
export function computeDailyClaimFromState(input: {
  userId: string
  state: ClaimStreakState
  now?: Date
  eligibleEconomicUsers?: number
}): ClaimComputeResult {
  const cfg = getEconomicConfig()
  const now = input.now || new Date()
  const today = lagosDayKey(now)
  const yesterday = lagosYesterdayKey(now)
  const state = input.state
  const idempotencyKey = `daily_claim_v12:${input.userId}:${today}`

  if (state.lastClaimDayKey === today) {
    return {
      ok: false,
      error: "ALREADY_CLAIMED_TODAY",
      cycleDay: state.cycleDay,
      dayKey: today,
    }
  }

  let cycleDay = 1
  let completedCycles = state.completedCycles
  let missedDayReset = false

  if (state.lastClaimDayKey) {
    if (state.lastClaimDayKey === yesterday) {
      if (state.cycleDay >= 7) {
        cycleDay = 1
        completedCycles = state.completedCycles + 1
      } else {
        cycleDay = state.cycleDay + 1
      }
    } else {
      cycleDay = 1
      missedDayReset = true
    }
  }

  const baseGross = baseGrossForCycleDay(cycleDay)
  const n =
    input.eligibleEconomicUsers != null
      ? Math.max(1, Math.floor(input.eligibleEconomicUsers))
      : getEligibleEconomicUsers()

  const demandSoFar = getCurrentDayDemand(today)
  const mPreview = applyNetworkEmission(baseGross, n, demandSoFar)
  const demandAfterM = demandSoFar + baseGross * mPreview.m
  const emitted = applyNetworkEmission(baseGross, n, demandAfterM)

  const grossMicro = toMicro(emitted.grossGhc)
  const { userMicro, reserveMicro } = splitClaimGrossMicro(grossMicro)

  return {
    ok: true,
    cycleDay,
    completedCycles,
    baseGross,
    m: emitted.m,
    g: emitted.g,
    grossGhc: fromMicro(grossMicro),
    userGhc: fromMicro(userMicro),
    reserveGhc: fromMicro(reserveMicro),
    userMicro,
    reserveMicro,
    dayKey: today,
    idempotencyKey,
    economicVersion: cfg.version,
    missedDayReset,
  }
}

/** Async: load state + resolve eligible users + compute */
export async function computeDailyClaim(input: {
  userId: string
  now?: Date
  eligibleEconomicUsers?: number
}): Promise<ClaimComputeResult> {
  const n =
    input.eligibleEconomicUsers != null
      ? Math.max(1, Math.floor(input.eligibleEconomicUsers))
      : await resolveEligibleEconomicUsers()
  cacheEligibleEconomicUsers(n)
  const state = await loadClaimStreakState(input.userId)
  return computeDailyClaimFromState({
    userId: input.userId,
    state,
    now: input.now,
    eligibleEconomicUsers: n,
  })
}

/**
 * Commit claim day authority (DB when configured), then local telemetry.
 * Must be called only after ledger credit succeeds (or in same controlled flow
 * where commit-before-ledger uses alreadyClaimed to prevent double credit).
 */
export async function commitDailyClaimState(input: {
  userId: string
  result: Extract<ClaimComputeResult, { ok: true }>
}): Promise<{ ok: boolean; alreadyClaimed?: boolean; error?: string }> {
  const r = input.result
  const completedCycles =
    r.cycleDay >= 7 ? r.completedCycles + 1 : r.completedCycles

  if (isDatabaseConfigured()) {
    const commit = await rpcCommitClaimDay({
      userId: input.userId,
      claimDayKey: r.dayKey,
      cycleDay: r.cycleDay,
      completedCycles,
      idempotencyKey: r.idempotencyKey,
      economicVersion: r.economicVersion,
    })
    if (!commit.ok) {
      return { ok: false, error: commit.error || "COMMIT_FAILED" }
    }
    if (commit.alreadyClaimed) {
      return { ok: true, alreadyClaimed: true }
    }
  } else {
    // Memory path (studio only)
    memoryStreakStore.set(input.userId, {
      userId: input.userId,
      cycleDay: r.cycleDay,
      completedCycles,
      lastClaimDayKey: r.dayKey,
      totalSuccessfulClaims:
        getClaimStreakStateMemory(input.userId).totalSuccessfulClaims + 1,
      economicVersion: r.economicVersion,
      lastIdempotencyKey: r.idempotencyKey,
    })
  }

  recordEmissionDemand(r.dayKey, r.baseGross * r.m)
  recordTelemetryEvent({
    type: "daily_claim",
    dayKey: r.dayKey,
    eligibleEconomicUsers: getEligibleEconomicUsers(),
    m: r.m,
    g: r.g,
    demand: getCurrentDayDemand(r.dayKey),
    budget: applyNetworkEmission(0, getEligibleEconomicUsers(), 0).budget,
    userIssuance: r.userGhc,
    reserveIssuance: r.reserveGhc,
    grossIssuance: r.grossGhc,
    sinks: 0,
    netCirculatingChange: r.userGhc,
    meta: {
      cycleDay: r.cycleDay,
      missedDayReset: r.missedDayReset,
      economicVersion: r.economicVersion,
      userId: input.userId,
      streakBackend: isDatabaseConfigured() ? "database" : "memory",
    },
  })

  return { ok: true, alreadyClaimed: false }
}
