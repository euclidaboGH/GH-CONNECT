"use client"

/**
 * Operator checklist mapped to Pi Developer Portal + greenhaven.pi claim.
 * Does not auto-complete portal steps.
 */

import { useEffect, useState } from "react"
import { ClipboardList, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react"

type Item = {
  id: string
  title: string
  portalMapsTo: string
  status: string
  detail: string
  evidence?: string
}

export function PiListingReadinessCard({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [meta, setMeta] = useState<{
    uniqueVerifiedPioneers?: number | null
    domainThreshold?: number
    domainThresholdMet?: boolean | null
    claimDeadlineHint?: string
    principles?: string[]
  }>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/operator/pi-listing-readiness", { cache: "no-store", credentials: "include" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) {
          setError(String(d?.error || "Could not load readiness (admin key may be required)"))
          return
        }
        setItems(Array.isArray(d.checklist) ? d.checklist : [])
        setMeta({
          uniqueVerifiedPioneers: d.uniqueVerifiedPioneers,
          domainThreshold: d.domainThreshold,
          domainThresholdMet: d.domainThresholdMet,
          claimDeadlineHint: d.claimDeadlineHint,
          principles: d.principles,
        })
      })
      .catch(() => {
        if (!cancelled) setError("Network error")
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <section className={`rounded-2xl border border-border/60 bg-card p-4 ${className}`}>
        <p className="text-[12px] text-muted-foreground">{error}</p>
      </section>
    )
  }

  if (!items.length) return null

  return (
    <section className={`rounded-2xl border border-border/60 bg-card p-4 ${className}`} aria-label="Pi listing readiness">
      <div className="mb-2 flex items-center gap-2">
        <ClipboardList size={16} className="text-emerald-700" />
        <h3 className="text-sm font-bold text-foreground">Pi portal & greenhaven.pi readiness</h3>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Domain claim deadline: <span className="font-semibold text-foreground">{meta.claimDeadlineHint || "see Pi notice"}</span>
        {meta.uniqueVerifiedPioneers != null ? (
          <>
            {" "}
            · Verified Pi sign-ins on this DB:{" "}
            <span className="font-semibold text-foreground">
              {meta.uniqueVerifiedPioneers}/{meta.domainThreshold ?? 5}
            </span>
          </>
        ) : null}
      </p>
      <ul className="space-y-2">
        {items.map((it) => {
          const ok = it.status === "ready"
          const warn = it.status === "action_required"
          return (
            <li key={it.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
              <div className="flex items-start gap-2">
                {ok ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${warn ? "text-amber-600" : "text-muted-foreground"}`} />
                )}
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-foreground">{it.title}</p>
                  <p className="text-[10px] text-muted-foreground">{it.portalMapsTo}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{it.detail}</p>
                  {it.evidence ? (
                    <p className="mt-0.5 font-mono text-[10px] text-foreground/80">{it.evidence}</p>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="/portal-setup"
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold"
        >
          Portal setup
        </a>
        <a
          href="/privacy"
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold"
        >
          Privacy Policy <ExternalLink size={12} />
        </a>
        <a
          href="/terms"
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold"
        >
          Terms <ExternalLink size={12} />
        </a>
        <a
          href="/validation-key.txt"
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold"
          target="_blank"
          rel="noreferrer"
        >
          validation-key.txt <ExternalLink size={12} />
        </a>
      </div>
      {meta.principles?.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-[10px] text-muted-foreground">
          {meta.principles.map((p) => (
            <li key={p.slice(0, 40)}>{p}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
