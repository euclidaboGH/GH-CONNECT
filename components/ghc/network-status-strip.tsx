"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

/** Thin offline banner — does not block content or navigation */
export function NetworkStatusStrip() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const onFlush = (ev: Event) => {
      try {
        const d = (ev as CustomEvent).detail as {
          stories?: number
          listings?: number
          posts?: number
          deletes?: number
          skipped?: boolean
        } | undefined
        if (!d || d.skipped) return
        const n = Number(d.stories || 0) + Number(d.listings || 0) + Number(d.posts || 0) + Number(d.deletes || 0)
        if (n <= 0) return
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: {
              message: n === 1 ? "Queued item synced" : `${n} queued items synced`,
              type: "success",
            },
          }),
        )
      } catch { /* */ }
    }
    window.addEventListener("ghc:reconnect-flush", onFlush as EventListener)
    return () => window.removeEventListener("ghc:reconnect-flush", onFlush as EventListener)
  }, [])

  const [online, setOnline] = useState(true)

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[90] w-[min(100%-1.5rem,28rem)] -translate-x-1/2 rounded-full border border-amber-500/30 bg-amber-50/95 px-3 py-1.5 text-center text-[11px] font-medium text-amber-900 shadow-sm backdrop-blur dark:bg-amber-950/90 dark:text-amber-100"
    >
      <span className="inline-flex items-center gap-1.5">
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        You&apos;re offline — changes will sync when you reconnect
      </span>
    </div>
  )
}
