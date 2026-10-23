"use client"

/**
 * Process-wide Daily Claim status coordinator.
 *
 * Multiple GreenHaven surfaces can display Daily Claim state at once. They must
 * share one server-authoritative request stream rather than starting one 30s
 * polling loop per mounted component.
 */
import { lagosDayKey } from "@/lib/domains/reward-level-domain"
import { getDailyClaimStatus, type DailyClaimStatusClientResult } from "./claim-daily-client"

export type DailyClaimStatus = {
  dayKey: string
  claimable: boolean
  claimedToday: boolean
  cycleDay: number
  lastClaimDayKey: string | null
}

type Listener = () => void

type Entry = {
  status: DailyClaimStatus | null
  revision: number
  listeners: Set<Listener>
  requestVersion: number
  inFlight: Promise<void> | null
  interval: number | null
  observedDay: string
}

const entries = new Map<string, Entry>()

function normalize(data: DailyClaimStatusClientResult): DailyClaimStatus | null {
  if (!data.ok || !data.dayKey || typeof data.claimable !== "boolean") return null
  return {
    dayKey: String(data.dayKey),
    claimable: data.claimable,
    claimedToday: Boolean(data.claimedToday),
    cycleDay: Math.max(1, Math.min(7, Number(data.cycleDay) || 1)),
    lastClaimDayKey: data.lastClaimDayKey ? String(data.lastClaimDayKey) : null,
  }
}

function notify(entry: Entry) {
  entry.revision += 1
  for (const listener of entry.listeners) listener()
}

function ensure(userId: string): Entry {
  const key = userId.trim()
  let entry = entries.get(key)
  if (entry) return entry
  entry = {
    status: null,
    revision: 0,
    listeners: new Set(),
    requestVersion: 0,
    inFlight: null,
    interval: null,
    observedDay: lagosDayKey(),
  }
  entries.set(key, entry)
  return entry
}

async function refreshEntry(userId: string, entry: Entry) {
  if (!userId.trim() || entry.inFlight) return entry.inFlight
  const version = ++entry.requestVersion
  entry.inFlight = getDailyClaimStatus()
    .then((data) => {
      if (version !== entry.requestVersion) return
      const next = normalize(data)
      if (!next) return
      const changed = JSON.stringify(next) !== JSON.stringify(entry.status)
      entry.status = next
      if (changed) notify(entry)
    })
    .catch(() => {
      // Preserve the last confirmed server state on transient failures.
    })
    .finally(() => {
      entry.inFlight = null
    })
  return entry.inFlight
}

function resumeEntry(userId: string, entry: Entry) {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return
  const currentDay = lagosDayKey()
  if (currentDay !== entry.observedDay) {
    entry.observedDay = currentDay
    void refreshEntry(userId, entry)
    return
  }
  void refreshEntry(userId, entry)
}

function attachRuntime(userId: string, entry: Entry) {
  if (typeof window === "undefined" || entry.interval !== null) return
  const onResume = () => resumeEntry(userId, entry)
  const onClaimed = () => void refreshEntry(userId, entry)
  const onVisibility = () => {
    if (document.visibilityState !== "hidden") onResume()
  }
  entry.interval = window.setInterval(() => {
    const currentDay = lagosDayKey()
    if (currentDay !== entry.observedDay) {
      entry.observedDay = currentDay
      void refreshEntry(userId, entry)
    }
  }, 30_000)
  window.addEventListener("focus", onResume)
  window.addEventListener("online", onResume)
  window.addEventListener("ghc:daily-reward-claimed", onClaimed)
  document.addEventListener("visibilitychange", onVisibility)
  ;(entry as Entry & { cleanup?: () => void }).cleanup = () => {
    if (entry.interval !== null) window.clearInterval(entry.interval)
    entry.interval = null
    window.removeEventListener("focus", onResume)
    window.removeEventListener("online", onResume)
    window.removeEventListener("ghc:daily-reward-claimed", onClaimed)
    document.removeEventListener("visibilitychange", onVisibility)
  }
}

export function subscribeDailyClaimStatus(userId: string, listener: Listener): () => void {
  const key = userId.trim()
  if (!key) return () => undefined
  const entry = ensure(key)
  entry.listeners.add(listener)
  attachRuntime(key, entry)
  if (entry.status === null) void refreshEntry(key, entry)
  return () => {
    entry.listeners.delete(listener)
    if (entry.listeners.size === 0) {
      ;(entry as Entry & { cleanup?: () => void }).cleanup?.()
      entries.delete(key)
    }
  }
}

export function getDailyClaimStatusSnapshot(userId: string): DailyClaimStatus | null {
  return userId.trim() ? ensure(userId).status : null
}

export function getDailyClaimStatusRevision(userId: string): number {
  return userId.trim() ? ensure(userId).revision : 0
}

export function refreshDailyClaimStatus(userId: string): Promise<void> {
  const key = userId.trim()
  if (!key) return Promise.resolve()
  return refreshEntry(key, ensure(key))
}
