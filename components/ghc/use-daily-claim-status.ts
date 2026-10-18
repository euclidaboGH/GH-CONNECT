"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { IdentityService } from "@/lib/identity/identity-service"
import { lagosDayKey } from "@/lib/domains/reward-level-domain"

export type ServerDailyClaimStatus = {
  dayKey: string
  claimable: boolean
  claimedToday: boolean
  cycleDay: number
  lastClaimDayKey: string | null
}

/**
 * Reconcile local reward presentation with the durable server streak.
 * Refreshes on mount, reward-day rollover, tab focus/visibility, network return,
 * and after a claim event. The client never uses this status to credit GHC.
 */
export function useDailyClaimStatus(userId: string, enabled = true) {
  const [status, setStatus] = useState<ServerDailyClaimStatus | null>(null)
  const [revision, setRevision] = useState(0)
  const requestVersion = useRef(0)

  const refresh = useCallback(async () => {
    if (!enabled || !userId.trim()) return
    const version = ++requestVersion.current
    try {
      const response = await fetch("/api/economy/rewards/daily", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(IdentityService.getAuthHeaders?.() || {}),
        },
      })
      if (version !== requestVersion.current || !response.ok) return
      const data = (await response.json().catch(() => null)) as
        | (ServerDailyClaimStatus & { ok?: boolean })
        | null
      if (version !== requestVersion.current || !data?.ok || !data.dayKey || typeof data.claimable !== "boolean") return
      setStatus({
        dayKey: String(data.dayKey),
        claimable: data.claimable,
        claimedToday: Boolean(data.claimedToday),
        cycleDay: Math.max(1, Math.min(7, Number(data.cycleDay) || 1)),
        lastClaimDayKey: data.lastClaimDayKey ? String(data.lastClaimDayKey) : null,
      })
      setRevision((value) => value + 1)
    } catch {
      // Keep the last confirmed status; local day-key logic remains the safe UI fallback.
    }
  }, [enabled, userId])

  useEffect(() => {
    if (!enabled) return
    setStatus(null)
    void refresh()
    let observedDay = lagosDayKey()
    const checkDay = () => {
      const currentDay = lagosDayKey()
      if (currentDay !== observedDay) {
        observedDay = currentDay
        setRevision((value) => value + 1)
        void refresh()
      }
    }
    const onResume = () => {
      if (document.visibilityState === "hidden") return
      checkDay()
      void refresh()
    }
    const onClaimed = () => void refresh()
    const interval = window.setInterval(checkDay, 30_000)
    window.addEventListener("focus", onResume)
    window.addEventListener("online", onResume)
    window.addEventListener("ghc:daily-reward-claimed", onClaimed)
    document.addEventListener("visibilitychange", onResume)
    return () => {
      requestVersion.current += 1
      window.clearInterval(interval)
      window.removeEventListener("focus", onResume)
      window.removeEventListener("online", onResume)
      window.removeEventListener("ghc:daily-reward-claimed", onClaimed)
      document.removeEventListener("visibilitychange", onResume)
    }
  }, [enabled, refresh])

  return { status, revision, refresh }
}
