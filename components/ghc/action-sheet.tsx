"use client"

/**
 * Canonical GH Connect contextual menu / action sheet.
 * Only ONE sheet open app-wide. Portal to document.body.
 * Always above bottom nav. Close: backdrop, Escape, Back, scroll, tab change.
 */

import {
  useEffect,
  useId,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

const CLOSE_ALL_EVENT = "ghc:close-action-sheets"
const OPEN_EVENT = "ghc:action-sheet-open"

export function closeAllActionSheets() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(CLOSE_ALL_EVENT))
}

export function ActionSheet({
  open,
  onClose,
  title = "Options",
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return

    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id } }))

    const onCloseAll = () => close()
    const onOpenOther = (e: Event) => {
      const otherId = (e as CustomEvent<{ id: string }>).detail?.id
      if (otherId && otherId !== id) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        close()
      }
    }

    let scrollArmed = false
    const armTimer = window.setTimeout(() => {
      scrollArmed = true
    }, 100)
    const onScroll = () => {
      if (scrollArmed) close()
    }

    const histKey = "ghcSheet"
    try {
      window.history.pushState({ [histKey]: id }, "")
    } catch {
      /* ignore */
    }
    const onPop = () => {
      close()
    }

    window.addEventListener(CLOSE_ALL_EVENT, onCloseAll)
    window.addEventListener(OPEN_EVENT, onOpenOther)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("popstate", onPop)
    window.addEventListener("ghc:navigate-tab", onCloseAll as EventListener)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Focus first actionable control; restore on close
    const prevActive = document.activeElement as HTMLElement | null
    const focusables = () =>
      panelRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) as NodeListOf<HTMLElement> | undefined
    requestAnimationFrame(() => {
      const list = focusables()
      list?.[0]?.focus?.()
    })
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return
      const list = Array.from(focusables() || []).filter((el) => !el.hasAttribute("disabled"))
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", onTab)

    return () => {
      window.removeEventListener("keydown", onTab)
      try {
        prevActive?.focus?.()
      } catch {
        /* */
      }
      window.clearTimeout(armTimer)
      window.removeEventListener(CLOSE_ALL_EVENT, onCloseAll)
      window.removeEventListener(OPEN_EVENT, onOpenOther)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("popstate", onPop)
      window.removeEventListener("ghc:navigate-tab", onCloseAll as EventListener)
      document.body.style.overflow = prevOverflow
    }
  }, [open, id, close])

  if (!open || typeof document === "undefined") return null

  const sheet = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Dismiss menu"
        onClick={close}
      />
      <div
        ref={panelRef}
        className="relative z-[201] flex w-full max-w-md flex-col rounded-t-3xl border border-border bg-card shadow-2xl sm:mb-6 sm:rounded-3xl"
        style={{
          marginBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
          maxHeight: "min(72vh, 32rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
        </div>
        <p className="shrink-0 px-4 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
          {children}
        </div>
        <div className="shrink-0 border-t border-border p-2">
          <button
            type="button"
            onClick={close}
            className="min-h-11 w-full rounded-2xl bg-muted py-3 text-sm font-bold text-foreground transition active:scale-[0.99]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}

export function ActionSheetItem({
  onClick,
  destructive,
  children,
  icon,
}: {
  onClick?: () => void
  destructive?: boolean
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold transition active:scale-[0.99] ${
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "text-foreground hover:bg-muted"
      }`}
    >
      {icon ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}
