"use client"

/**
 * Lightweight activation checklist for Home.
 * Presentation only — completion is passed in from real data (never invented here).
 */

import { Check, X, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ActivationChecklistResult, ActivationItem } from "@/lib/domains/adapters/home-activation-checklist"
import { navigateTo } from "@/lib/navigation/navigate"

function go(target: ActivationItem["target"]) {
  if (target === "compose") {
    try {
      window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: { kind: "post" } }))
    } catch {
      /* */
    }
    return
  }
  if (target === "home") return
  if (!navigateTo(target)) {
    try {
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: target }))
    } catch {
      /* */
    }
  }
}

export function HomeActivationChecklist({
  checklist,
}: {
  checklist: ActivationChecklistResult
}) {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (checklist.complete || typeof window === "undefined") return
    const clearTimers = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      idleTimer.current = null
      hideTimer.current = null
    }
    const scheduleIdlePrompt = () => {
      clearTimers()
      idleTimer.current = setTimeout(() => {
        setVisible(true)
        hideTimer.current = setTimeout(() => {
          setVisible(false)
          setExpanded(false)
          scheduleIdlePrompt()
        }, 9000)
      }, 45000)
    }
    const onActivity = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-gh-setup-notice="true"]')) return
      setVisible(false)
      setExpanded(false)
      scheduleIdlePrompt()
    }
    scheduleIdlePrompt()
    window.addEventListener("pointerdown", onActivity, { passive: true })
    window.addEventListener("keydown", onActivity)
    window.addEventListener("scroll", onActivity, { passive: true })
    window.addEventListener("visibilitychange", onActivity)
    return () => {
      clearTimers()
      window.removeEventListener("pointerdown", onActivity)
      window.removeEventListener("keydown", onActivity)
      window.removeEventListener("scroll", onActivity)
      window.removeEventListener("visibilitychange", onActivity)
    }
  }, [checklist.complete])

  if (checklist.complete || !visible) return null

  return (
    <aside
      data-gh-setup-notice="true"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] left-3 right-3 z-[70] mx-auto max-w-md animate-in slide-in-from-bottom-2 duration-300"
      aria-label="GreenHaven setup reminder"
      role="status"
    >
      <div className="overflow-hidden rounded-2xl border border-emerald-600/20 bg-card/95 shadow-xl backdrop-blur-xl">
        <div className="flex items-start gap-3 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"><Sparkles size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-bold">Make GreenHaven yours</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{checklist.doneCount} of {checklist.total} setup steps complete · {checklist.percent}%</p>
              </div>
              <button type="button" onClick={() => { setVisible(false); setExpanded(false) }} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Dismiss setup reminder"><X size={16} /></button>
            </div>
            {expanded ? (
              <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                {checklist.items.filter((item) => !item.done).map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => go(item.target)} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium hover:bg-muted/70">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <span className="min-w-0 flex-1">{item.label}</span>
                      <span className="text-emerald-700 dark:text-emerald-300">Open</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${checklist.percent}%` }} /></span>
              <button type="button" onClick={() => setExpanded((value) => !value)} className="shrink-0 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800">{expanded ? "Less" : "Continue setup"}</button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
