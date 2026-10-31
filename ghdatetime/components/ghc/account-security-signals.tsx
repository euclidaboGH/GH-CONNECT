"use client"

/**
 * Displays honest anti-fraud readiness signals. Never shows a false KYC badge.
 */

import { useEffect, useState } from "react"
import { Shield } from "lucide-react"

type Signal = {
  id: string
  level: "info" | "ok" | "attention"
  title: string
  detail: string
}

export function AccountSecuritySignals({ className = "" }: { className?: string }) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [note, setNote] = useState("")

  useEffect(() => {
    let cancelled = false
    void fetch("/api/security/account-signals", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d?.ok && Array.isArray(d.signals)) setSignals(d.signals)
        setNote(String(d?.note || ""))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!signals.length) return null

  return (
    <section className={`rounded-2xl border border-border/60 bg-card p-4 ${className}`} aria-label="Account security signals">
      <div className="mb-2 flex items-center gap-2">
        <Shield size={16} className="text-emerald-700" />
        <h3 className="text-sm font-bold text-foreground">Account trust signals</h3>
      </div>
      <ul className="space-y-2">
        {signals.map((s) => (
          <li key={s.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p
              className={`text-[12px] font-bold ${
                s.level === "ok"
                  ? "text-emerald-800 dark:text-emerald-200"
                  : s.level === "attention"
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-foreground"
              }`}
            >
              {s.title}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.detail}</p>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-2 text-[10px] text-muted-foreground">{note}</p> : null}
    </section>
  )
}
