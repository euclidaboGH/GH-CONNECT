/**
 * ECONOMY_VERSION 1.2 — Auditable economic telemetry (append-only in-process).
 * Production may mirror these events to a dedicated table / log stream.
 */

export type TelemetryEventType =
  | "daily_claim"
  | "activity_reward"
  | "achievement"
  | "bonus"
  | "promotion"
  | "sink_vip"
  | "sink_vvip"
  | "sink_boost"
  | "governor_snapshot"
  | "warning"

export type EconomicTelemetryEvent = {
  id: string
  ts: number
  type: TelemetryEventType
  dayKey: string
  eligibleEconomicUsers: number
  m: number
  g: number
  demand: number
  budget: number
  userIssuance: number
  reserveIssuance: number
  grossIssuance: number
  sinks: number
  netCirculatingChange: number
  meta?: Record<string, unknown>
}

const events: EconomicTelemetryEvent[] = []
let seq = 0

export function recordTelemetryEvent(
  e: Omit<EconomicTelemetryEvent, "id" | "ts"> & { ts?: number }
): EconomicTelemetryEvent {
  seq += 1
  const row: EconomicTelemetryEvent = {
    id: `tel_${Date.now()}_${seq}`,
    ts: e.ts ?? Date.now(),
    type: e.type,
    dayKey: e.dayKey,
    eligibleEconomicUsers: e.eligibleEconomicUsers,
    m: e.m,
    g: e.g,
    demand: e.demand,
    budget: e.budget,
    userIssuance: e.userIssuance,
    reserveIssuance: e.reserveIssuance,
    grossIssuance: e.grossIssuance,
    sinks: e.sinks,
    netCirculatingChange: e.netCirculatingChange,
    meta: e.meta,
  }
  events.push(row)
  // Cap memory
  if (events.length > 50_000) {
    events.splice(0, events.length - 40_000)
  }
  return row
}

export function listTelemetryEvents(limit = 100): EconomicTelemetryEvent[] {
  const n = Math.max(1, Math.min(1000, limit | 0))
  return events.slice(-n)
}

export function clearTelemetryForTests(): void {
  events.length = 0
  seq = 0
}

export function aggregateTelemetry(dayKey?: string): {
  userIssuance: number
  reserveIssuance: number
  grossIssuance: number
  sinks: number
  netCirculatingChange: number
  count: number
} {
  let userIssuance = 0
  let reserveIssuance = 0
  let grossIssuance = 0
  let sinks = 0
  let netCirculatingChange = 0
  let count = 0
  for (const e of events) {
    if (dayKey && e.dayKey !== dayKey) continue
    userIssuance += e.userIssuance
    reserveIssuance += e.reserveIssuance
    grossIssuance += e.grossIssuance
    sinks += e.sinks
    netCirculatingChange += e.netCirculatingChange
    count += 1
  }
  return {
    userIssuance,
    reserveIssuance,
    grossIssuance,
    sinks,
    netCirculatingChange,
    count,
  }
}
