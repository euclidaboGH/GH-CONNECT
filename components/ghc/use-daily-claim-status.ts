"use client"

import { useCallback, useSyncExternalStore } from "react"
import {
  getDailyClaimStatusRevision,
  getDailyClaimStatusSnapshot,
  refreshDailyClaimStatus,
  subscribeDailyClaimStatus,
  type DailyClaimStatus,
} from "@/lib/rewards/daily-claim-status-store"

export type ServerDailyClaimStatus = DailyClaimStatus

/**
 * Shared server-authoritative Daily Claim state.
 * All mounted surfaces subscribe to one process-wide request coordinator.
 */
export function useDailyClaimStatus(userId: string, enabled = true) {
  const key = enabled ? userId.trim() : ""
  const subscribe = useCallback(
    (listener: () => void) => subscribeDailyClaimStatus(key, listener),
    [key],
  )
  const getSnapshot = useCallback(() => getDailyClaimStatusSnapshot(key), [key])
  const getRevision = useCallback(() => getDailyClaimStatusRevision(key), [key])

  const status = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const revision = useSyncExternalStore(subscribe, getRevision, () => 0)
  const refresh = useCallback(() => refreshDailyClaimStatus(key), [key])

  return { status, revision, refresh }
}
