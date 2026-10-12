"use client"

import { useEffect, type RefObject } from "react"

/**
 * Lightweight focus trap for modal sheets (Section I).
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!active) return
    const root = containerRef.current
    if (!root) return

    const selector =
      'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      )

    const previously = document.activeElement as HTMLElement | null
    const list = focusables()
    if (list[0]) list[0].focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    root.addEventListener("keydown", onKey)
    return () => {
      root.removeEventListener("keydown", onKey)
      previously?.focus?.()
    }
  }, [active, containerRef])
}
