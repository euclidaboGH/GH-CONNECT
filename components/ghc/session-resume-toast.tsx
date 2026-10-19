"use client"

import { useEffect, useRef } from "react"

/**
 * On visibility restore after a long background, emit a soft reconcile signal.
 * Does not invent data — only asks existing hydrators to run.
 */
export function SessionResumeToast() {
  const hiddenAt = useRef<number | null>(null)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now()
        return
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0
      hiddenAt.current = null
      if (away < 45_000) return
      try {
        window.dispatchEvent(new CustomEvent("ghc:session-resume", { detail: { awayMs: away } }))
        window.dispatchEvent(new CustomEvent("ghc:toast", {
          detail: {
            message: "Welcome back — refreshing your feed and inbox",
            type: "info",
          },
        }))
      } catch {
        /* */
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])
  return null
}
