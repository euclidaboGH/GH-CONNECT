"use client"

import { useEffect } from "react"

/**
 * Global shortcuts are deliberately conservative: never steal keystrokes from
 * editable controls, IME composition, modal workflows, or browser modifiers.
 */
export function GlobalHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.keyCode === 229) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return

      const target = e.target instanceof HTMLElement ? e.target : null
      if (target) {
        const editable = target.isContentEditable || target.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"], [data-shortcuts-disabled="true"]',
        )
        const modal = target.closest('[role="dialog"], [aria-modal="true"]')
        if (editable || modal) return
      }

      if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>(
          '[data-ghc-search="1"], input[aria-label*="search" i], input[placeholder*="search" i]',
        )
        if (!search || search.disabled || search.getAttribute("aria-hidden") === "true") return
        e.preventDefault()
        search.focus({ preventScroll: true })
        return
      }

      if (e.key.toLowerCase() === "c") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: { mode: "post" } }))
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return null
}
