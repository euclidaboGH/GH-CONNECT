"use client"

import { useEffect, useState } from "react"
import { WifiOff, Wifi } from "lucide-react"

/**
 * Non-blocking network status.
 * Offline: amber strip. Brief "Back online" confirmation after restore.
 * Does not claim sync success — only connectivity.
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
        className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-600/95 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <WifiOff size={14} aria-hidden />
        You&apos;re offline — you can still browse cached content. Actions queue until you&apos;re back.
      </div>
    )
  }

  if (justOnline) {
    return (
      <div
        className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-emerald-700/95 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <Wifi size={14} aria-hidden />
        Back online — pending actions will retry when ready
      </div>
    )
  }

  return null
}
