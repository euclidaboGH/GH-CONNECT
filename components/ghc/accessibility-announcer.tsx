"use client"

import { useEffect, useRef } from "react"

/** Announces major shell navigation changes without stealing focus. */
export function AccessibilityAnnouncer({ label }: { label: string }) {
  const liveRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = liveRef.current
    if (!node) return
    node.textContent = ""
    const timer = window.setTimeout(() => {
      node.textContent = `${label} section loaded.`
    }, 40)
    return () => window.clearTimeout(timer)
  }, [label])

  return (
    <div
      ref={liveRef}
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
    />
  )
}
