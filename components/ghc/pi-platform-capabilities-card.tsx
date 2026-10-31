"use client"

/**
 * Operator/user-facing honesty about what Pi provides vs GreenHaven owns.
 */

import { useEffect, useState } from "react"
import { Layers } from "lucide-react"

type Cap = {
  id: string
  title: string
  status: string
  detail: string
  engagementOnly?: boolean
}

export function PiPlatformCapabilitiesCard({ className = "" }: { className?: string }) {
  const [caps, setCaps] = useState<Cap[]>([])
  const [env, setEnv] = useState<string>("")
  const [principles, setPrinciples] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/pi/platform-capabilities", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) return
        setCaps(Array.isArray(d.capabilities) ? d.capabilities : [])
        setEnv(String(d.environment || ""))
        setPrinciples(Array.isArray(d.principles) ? d.principles : [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!caps.length) return null

  const statusColor = (s: string) => {
    if (s === "live") return "text-emerald-700 dark:text-emerald-300"
    if (s === "configured") return "text-sky-700 dark:text-sky-300"
    if (s === "not_integrated") return "text-muted-foreground"
    return "text-amber-700 dark:text-amber-300"
  }

  return (
    <section className={`rounded-2xl border border-border/60 bg-card p-4 ${className}`} aria-label="Pi platform capabilities">
      <div className="mb-2 flex items-center gap-2">
        <Layers size={16} className="text-violet-700" />
        <h3 className="text-sm font-bold text-foreground">Pi × GreenHaven capabilities</h3>
      </div>
      {env ? (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Detected environment: <span className="font-semibold text-foreground">{env}</span>
        </p>
      ) : null}
      <ul className="space-y-2">
        {caps.map((c) => (
          <li key={c.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold text-foreground">{c.title}</p>
              <span className={`text-[10px] font-bold uppercase ${statusColor(c.status)}`}>{c.status.replace(/_/g, " ")}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{c.detail}</p>
            {c.engagementOnly ? (
              <p className="mt-1 text-[10px] font-semibold text-amber-800 dark:text-amber-200">Engagement signal only — not a balance</p>
            ) : null}
          </li>
        ))}
      </ul>
      {principles.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-[10px] text-muted-foreground">
          {principles.map((p) => (
            <li key={p.slice(0, 24)}>{p}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
