"use client"

import { useEffect } from "react"

/**
 * Global hotkeys:
 * - `/` focuses header search when not typing in an input
 * - `c` opens compose (post) when not typing
 */
export function GlobalHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = (t?.tagName || "").toLowerCase()
      if (tag === "input" || tag === "textarea" || (t as HTMLElement)?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "/") {
        e.preventDefault()
        const el =
          document.querySelector<HTMLInputElement>('[data-ghc-search="1"]') ||
          document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')
        el?.focus()
        return
      }
      if (e.key === "c" || e.key === "C") {
        try {
          window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: { mode: "post" } }))
        } catch {
          /* */
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  return null
}
