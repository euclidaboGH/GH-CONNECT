"use client"

import { useEffect, useState } from "react"
import { Scale, CheckCircle2, AlertTriangle } from "lucide-react"

type Item = { id: string; title: string; status: string; detail: string }

export function CompliancePostureCard({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [summary, setSummary] = useState("")

  useEffect(() => {
    let cancelled = false
    void fetch("/api/public/compliance-posture", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) return
        setItems(Array.isArray(d.items) ? d.items : [])
        setSummary(String(d.summary || ""))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!items.length) return null

  return (
    <section className={`rounded-2xl border border-border/60 bg-card p-4 ${className}`} aria-label="Listing compliance">
      <div className="mb-2 flex items-center gap-2">
        <Scale size={16} className="text-sky-700" />
        <h3 className="text-sm font-bold text-foreground">Mainnet listing compliance</h3>
      </div>
      {summary ? <p className="mb-2 text-[11px] text-muted-foreground">{summary}</p> : null}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <div className="flex items-start gap-2">
              {it.status === "pass" ? (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
              )}
              <div>
                <p className="text-[12px] font-bold text-foreground">{it.title}</p>
                <p className="text-[11px] text-muted-foreground">{it.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
