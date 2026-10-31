/**
 * ECONOMY_VERSION 1.2 — Activity emission under unified controller.
 * Pre-control caps: 0.5 GHC/day, 2.5 GHC/week. Then m × g.
 * Production authority: durable DB windows + global demand (multi-instance).
 * Memory path: Studio/test only when DB is not configured.
 */

import {
  ACTIVITY_DAILY_CAP_GHC,
  ACTIVITY_WEEKLY_CAP_GHC,
  ECONOMY_VERSION,
  fromMicro,
  toMicro,
} from "@/lib/server/economy/economic-config"
import {
  applyNetworkEmission,
  getCurrentDayDemand,
  getEligibleEconomicUsers,
  recordEmissionDemand,
} from "@/lib/server/economy/network-scarcity"
import { lagosDayKey } from "@/lib/server/economy/claim-engine"
import { recordTelemetryEvent } from "@/lib/server/economy/telemetry"
import {
  durableGetGlobalDemand,
  durableRecordGlobalDemand,
  durableTryActivityGrant,
} from "@/lib/server/economy/durable-emission"
import { isDatabaseConfigured } from "@/lib/server/economy/http"

type UserWindow = {
  dayKey: string
  dayGranted: number
  weekKey: string
  weekGranted: number
}

const windows = new Map<string, UserWindow>()

function weekKeyFromDay(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00Z`)
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const dayOfYear =
    Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const week = Math.floor((dayOfYear - 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

function getWindow(userId: string, dayKey: string): UserWindow {
  const w = windows.get(userId)
  const wk = weekKeyFromDay(dayKey)
  if (!w) {
    const nw = { dayKey, dayGranted: 0, weekKey: wk, weekGranted: 0 }
    windows.set(userId, nw)
    return nw
  }
  if (w.dayKey !== dayKey) {
    w.dayKey = dayKey
    w.dayGranted = 0
  }
  if (w.weekKey !== wk) {
    w.weekKey = wk
    w.weekGranted = 0
  }
  return w
}

export function clearActivityWindowsForTests(): void {
  windows.clear()
}

export type ActivityEmissionResult =
  | {
      ok: true
      baseGhc: number
      grantedGhc: number
      m: number
      g: number
      dayRemaining: number
      weekRemaining: number
      economicVersion: string
      capped: boolean
    }
  | {
      ok: false
      error: string
      dayRemaining: number
      weekRemaining: number
    }

/** Memory-only compute (tests / Studio). Prefer computeAndCommitActivityEmissionDurable. */
export function computeActivityEmission(input: {
  userId: string
  baseAmountGhc: number
  dayKey?: string
  eligibleEconomicUsers?: number
}): ActivityEmissionResult {
  const dayKey = input.dayKey || lagosDayKey()
  const w = getWindow(input.userId, dayKey)
  const dayRem = Math.max(0, ACTIVITY_DAILY_CAP_GHC - w.dayGranted)
  const weekRem = Math.max(0, ACTIVITY_WEEKLY_CAP_GHC - w.weekGranted)
  const room = Math.min(dayRem, weekRem)

  if (room <= 0) {
    return {
      ok: false,
      error: "ACTIVITY_CAP_REACHED",
      dayRemaining: dayRem,
      weekRemaining: weekRem,
    }
  }

  const base = Math.max(0, Number(input.baseAmountGhc) || 0)
  if (base <= 0) {
    return {
      ok: false,
      error: "INVALID_AMOUNT",
      dayRemaining: dayRem,
      weekRemaining: weekRem,
    }
  }

  const cappedBase = Math.min(base, room)
  const n =
    input.eligibleEconomicUsers != null
      ? Math.max(1, Math.floor(input.eligibleEconomicUsers))
      : getEligibleEconomicUsers()

  const demandSoFar = getCurrentDayDemand(dayKey)
  const mOnly = applyNetworkEmission(cappedBase, n, demandSoFar)
  const demandAfterM = demandSoFar + cappedBase * mOnly.m
  const emitted = applyNetworkEmission(cappedBase, n, demandAfterM)
  const grantedGhc = fromMicro(toMicro(emitted.grossGhc))

  return {
    ok: true,
    baseGhc: cappedBase,
    grantedGhc,
    m: emitted.m,
    g: emitted.g,
    dayRemaining: dayRem - cappedBase,
    weekRemaining: weekRem - cappedBase,
    economicVersion: ECONOMY_VERSION,
    capped: cappedBase < base,
  }
}

export function commitActivityEmission(input: {
  userId: string
  result: Extract<ActivityEmissionResult, { ok: true }>
  dayKey?: string
}): void {
  const dayKey = input.dayKey || lagosDayKey()
  const w = getWindow(input.userId, dayKey)
  w.dayGranted += input.result.baseGhc
  w.weekGranted += input.result.baseGhc
  recordEmissionDemand(dayKey, input.result.baseGhc * input.result.m)

  recordTelemetryEvent({
    type: "activity_reward",
    dayKey,
    eligibleEconomicUsers: getEligibleEconomicUsers(),
    m: input.result.m,
    g: input.result.g,
    demand: getCurrentDayDemand(dayKey),
    budget: applyNetworkEmission(0, getEligibleEconomicUsers(), 0).budget,
    userIssuance: input.result.grantedGhc,
    reserveIssuance: 0,
    grossIssuance: input.result.grantedGhc,
    sinks: 0,
    netCirculatingChange: input.result.grantedGhc,
    meta: {
      userId: input.userId,
      baseGhc: input.result.baseGhc,
      capped: input.result.capped,
      economicVersion: input.result.economicVersion,
    },
  })
}

/** Production path: durable caps + demand when DB configured */
export async function computeAndCommitActivityEmissionDurable(input: {
  userId: string
  baseAmountGhc: number
  dayKey?: string
  eligibleEconomicUsers?: number
}): Promise<ActivityEmissionResult> {
  const dayKey = input.dayKey || lagosDayKey()
  const base = Math.max(0, Number(input.baseAmountGhc) || 0)
  if (base <= 0) {
    return {
      ok: false,
      error: "INVALID_AMOUNT",
      dayRemaining: ACTIVITY_DAILY_CAP_GHC,
      weekRemaining: ACTIVITY_WEEKLY_CAP_GHC,
    }
  }

  const n =
    input.eligibleEconomicUsers != null
      ? Math.max(1, Math.floor(input.eligibleEconomicUsers))
      : getEligibleEconomicUsers()

  if (isDatabaseConfigured()) {
    const wk = weekKeyFromDay(dayKey)
    const grant = await durableTryActivityGrant({
      userId: input.userId,
      dayKey,
      weekKey: wk,
      requested: base,
      dailyCap: ACTIVITY_DAILY_CAP_GHC,
      weeklyCap: ACTIVITY_WEEKLY_CAP_GHC,
    })
    if (!grant) {
      return {
        ok: false,
        error: "ACTIVITY_DURABLE_UNAVAILABLE",
        dayRemaining: 0,
        weekRemaining: 0,
      }
    }
    if (!grant.ok || grant.granted <= 0) {
      return {
        ok: false,
        error: grant.error || "ACTIVITY_CAP_REACHED",
        dayRemaining: grant.dayRemaining,
        weekRemaining: grant.weekRemaining,
      }
    }
    const cappedBase = grant.granted
    const demandSoFar = (await durableGetGlobalDemand(dayKey)) ?? 0
    const mOnly = applyNetworkEmission(cappedBase, n, demandSoFar)
    const demandAfterM = demandSoFar + cappedBase * mOnly.m
    const emitted = applyNetworkEmission(cappedBase, n, demandAfterM)
    await durableRecordGlobalDemand(dayKey, cappedBase * emitted.m)
    const grantedGhc = fromMicro(toMicro(emitted.grossGhc))
    recordTelemetryEvent({
      type: "activity_reward",
      dayKey,
      eligibleEconomicUsers: n,
      m: emitted.m,
      g: emitted.g,
      demand: demandAfterM,
      budget: emitted.budget,
      userIssuance: grantedGhc,
      reserveIssuance: 0,
      grossIssuance: grantedGhc,
      sinks: 0,
      netCirculatingChange: grantedGhc,
      meta: { userId: input.userId, durable: true, baseGhc: cappedBase },
    })
    return {
      ok: true,
      baseGhc: cappedBase,
      grantedGhc,
      m: emitted.m,
      g: emitted.g,
      dayRemaining: grant.dayRemaining,
      weekRemaining: grant.weekRemaining,
      economicVersion: ECONOMY_VERSION,
      capped: cappedBase < base,
    }
  }

  const computed = computeActivityEmission(input)
  if (computed.ok) {
    commitActivityEmission({ userId: input.userId, result: computed, dayKey })
  }
  return computed
}
