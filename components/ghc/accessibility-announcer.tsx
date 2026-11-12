"use client"

import { useEffect, useRef } from "react"
import { getShellMessage } from "@/lib/i18n/shell"

/** Announces major shell navigation changes without stealing focus. */
export function AccessibilityAnnouncer({ label, locale = "en-US" }: { label: string; locale?: string }) {
  const liveRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = liveRef.current
    if (!node) return
    node.textContent = ""
    const timer = window.setTimeout(() => {
      node.textContent = `${label} — ${getShellMessage("sectionLoaded", locale)}`
    }, 40)
    return () => window.clearTimeout(timer)
  }, [label, locale])

  return (
    <div
      ref={liveRef}
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
      aria-relevant="additions text"
    />
  )
}
