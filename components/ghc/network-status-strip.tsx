"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

/** Thin offline banner — does not block content or navigation */
export function NetworkStatusStrip() {
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
