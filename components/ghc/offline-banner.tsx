"use client"

import { useEffect, useState } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { PendingQueueChip } from "./pending-queue-chip"

/**
 * Non-blocking network status overlay.
 * Fixed under the status area so it does not push page headers downward.
 * Offline: amber. Brief "Back online" after restore. Does not claim sync success.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [justOnline, setJustOnline] = useState(false)

  useEffect(() => {
    const sync = () => {
      const off = typeof navigator !== "undefined" ? !navigator.onLine : false
      setOffline((wasOff) => {
        if (wasOff && !off) {
          setJustOnline(true)
          window.setTimeout(() => setJustOnline(false), 2500)
        }
        return off
      })
    }
    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])

  if (offline) {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-[70] flex justify-center px-3 pt-1"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-amber-600/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
          <WifiOff size={14} aria-hidden />
          <span>You&apos;re offline — actions queue until you&apos;re back.</span>
          <PendingQueueChip />
        </div>
      </div>
    )
  }

  if (justOnline) {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-[70] flex justify-center px-3 pt-1"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-emerald-700/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
          <Wifi size={14} aria-hidden />
          <span>Back online — pending actions will retry when ready</span>
          <PendingQueueChip />
        </div>
      </div>
    )
  }

  return null
}
