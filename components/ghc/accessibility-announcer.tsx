"use client"

import { useEffect, useRef } from "react"

/** Announces major shell navigation changes without stealing focus. */
export function AccessibilityAnnouncer({ label }: { label: string }) {
  const liveRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = liveRef.current
    if (!node) return

    // Navigation changes select a panel; they do not guarantee that every
    // network-backed item inside that panel has finished loading.
    const safeLabel = typeof label === "string"
      ? label.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80)
      : ""
    if (!safeLabel) return

    node.textContent = ""
    const timer = window.setTimeout(() => {
      node.textContent = `${safeLabel} section selected.`
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
