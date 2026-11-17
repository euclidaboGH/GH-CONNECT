"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Wifi, WifiOff, Zap } from "lucide-react"
import { PendingQueueChip } from "./pending-queue-chip"

type ConnectionState = {
  online: boolean
  effectiveType: string | null
  saveData: boolean
}

function readConnectionState(): ConnectionState {
  if (typeof window === "undefined") return { online: true, effectiveType: null, saveData: false }
  const nav = navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }
  return {
    online: navigator.onLine,
    effectiveType: nav.connection?.effectiveType ?? null,
    saveData: Boolean(nav.connection?.saveData),
  }
}

/** One calm, non-blocking network surface for offline, restored, and constrained connections. */
export function NetworkResilience() {
  const [state, setState] = useState<ConnectionState>(() => readConnectionState())
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const sync = () => {
      const next = readConnectionState()
      setState((previous) => {
        if (!previous.online && next.online) {
          setRestored(true)
          window.setTimeout(() => setRestored(false), 2800)
        }
        return next
      })
    }

    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)

    const connection = (navigator as Navigator & { connection?: EventTarget }).connection
    connection?.addEventListener?.("change", sync)

    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
      connection?.removeEventListener?.("change", sync)
    }
  }, [])

  const constrained = state.online && (state.saveData || state.effectiveType === "slow-2g" || state.effectiveType === "2g")

  if (!state.online) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-[90] flex justify-center px-3 pt-1" role="status" aria-live="polite">
        <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-amber-500/20 bg-amber-600/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
          <WifiOff size={14} aria-hidden />
          <span className="min-w-0">Offline — live updates and server actions may be unavailable.</span>
          <PendingQueueChip />
        </div>
      </div>
    )
  }

  if (restored) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-[90] flex justify-center px-3 pt-1" role="status" aria-live="polite">
        <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-700/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
          <CheckCircle2 size={14} aria-hidden />
          <span>Connection restored — GreenHaven is catching up.</span>
          <PendingQueueChip />
        </div>
      </div>
    )
  }

  if (constrained) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-[90] flex justify-center px-3 pt-1" role="status" aria-live="polite">
        <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-sky-500/20 bg-sky-700/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
          <Zap size={14} aria-hidden />
          <span>Connection is limited — background work is being reduced.</span>
        </div>
      </div>
    )
  }

  return null
}
