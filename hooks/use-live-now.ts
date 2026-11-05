"use client"

import { useEffect, useState } from "react"

/** A cheap clock for UI that needs relative-time labels to stay current. */
export function useLiveNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), Math.max(15_000, intervalMs))
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
