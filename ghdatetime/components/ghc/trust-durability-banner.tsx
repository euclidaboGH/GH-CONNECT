"use client"

/**
 * Soft trust banner when foundation readiness is degraded (identity/session durability).
 * Non-blocking. Shown sparingly so production users aren’t alarmed by ops noise.
 * Hide entirely when status is ready or when user dismisses.
 */

import { useEffect, useState } from "react"
import { ShieldAlert, X } from "lucide-react"

const DISMISS_KEY = "ghc-trust-durability-banner-v1"

export function TrustDurabilityBanner() {
  const [show, setShow] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return
    } catch {
      /* */
    }
    void (async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store", credentials: "include" })
        const data = (await res.json().catch(() => ({}))) as {
          status?: string
          environment?: { isProduction?: boolean }
          blockers?: string[]
          checks?: Array<{ id: string; status: string }>
        }
        if (cancelled) return
        // Only surface when durability-related checks fail — not every degraded hint
        const durableFail = (data.checks || []).some(
          (c) =>
            (c.id === "identity_durable" || c.id === "session_durable") &&
            c.status === "fail"
        )
        if (!durableFail && data.status !== "not_ready") return
        if (data.environment?.isProduction && data.status === "ready") return
        setDetail(
          durableFail
            ? "This deployment may not remember your session after a restart until the database is connected. Your Pi login still identifies you."
            : "Some security configuration is incomplete on this deployment. Core browsing still works."
        )
        setShow(true)
      } catch {
        /* silent */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!show || !detail) return null

  return (
    <div
      className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
      <p className="min-w-0 flex-1 leading-snug">{detail}</p>
      <button
        type="button"
        className="shrink-0 rounded-full p-1 text-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/50"
        aria-label="Dismiss"
        onClick={() => {
          setShow(false)
          try {
            window.localStorage.setItem(DISMISS_KEY, "1")
          } catch {
            /* */
          }
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
