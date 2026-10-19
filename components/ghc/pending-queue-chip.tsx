"use client"

import { useEffect, useState } from "react"
import { CloudUpload } from "lucide-react"

/** Shows pending offline action count when > 0. */
export function PendingQueueChip() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const tick = () => {
      try {
        // dynamic import avoid SSR issues
        void import("@/lib/network-resilience").then(({ offlineQueue }) => {
          const q = offlineQueue.getQueue?.() || []
          setCount(Array.isArray(q) ? q.length : 0)
        })
      } catch {
        setCount(0)
      }
    }
    tick()
    const id = window.setInterval(tick, 4000)
    window.addEventListener("online", tick)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("online", tick)
    }
  }, [])
  if (count <= 0) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
      title={`${count} action(s) waiting to sync`}
    >
      <CloudUpload size={11} aria-hidden />
      {count} pending
    </span>
  )
}
