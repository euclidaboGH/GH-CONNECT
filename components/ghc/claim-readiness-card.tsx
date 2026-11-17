"use client"

import { useEffect, useState } from "react"
import { Flag } from "lucide-react"

export function ClaimReadinessCard({ className = "" }: { className?: string }) {
  const [scores, setScores] = useState<Record<string, unknown> | null>(null)
  const [steps, setSteps] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/operator/claim-readiness-report", { cache: "no-store", credentials: "include" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) {
          setError(String(d?.error || "Report unavailable"))
          return
        }
        setScores(d.scores || null)
        setSteps(Array.isArray(d.operatorNextSteps) ? d.operatorNextSteps : [])
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
  if (!scores) return null

  return (
    <section className={`rounded-2xl border border-border/60 bg-card p-4 ${className}`} aria-label="Claim readiness">
      <div className="mb-2 flex items-center gap-2">
        <Flag size={16} className="text-violet-700" />
        <h3 className="text-sm font-bold text-foreground">greenhaven.pi claim readiness</h3>
      </div>
      <ul className="space-y-1 text-[11px] text-muted-foreground">
        <li>
          Portal checklist:{" "}
          <span className="font-semibold text-foreground">
            {String(scores.portalChecklistReady)}/{String(scores.portalChecklistTotal)}
          </span>
        </li>
        <li>
          Compliance pass:{" "}
          <span className="font-semibold text-foreground">
            {String(scores.compliancePass)}/{String(scores.complianceTotal)}
          </span>
        </li>
        <li>
          Verified Pioneers (app DB):{" "}
          <span className="font-semibold text-foreground">
            {String(scores.uniqueVerifiedPioneers ?? "—")}/{String(scores.domainThreshold ?? 5)}
          </span>
          {scores.domainThresholdMet === true ? " · threshold met (app-side)" : ""}
        </li>
      </ul>
      {steps.length ? (
        <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[10px] text-muted-foreground">
          {steps.map((s) => (
            <li key={s.slice(0, 28)}>{s}</li>
          ))}
        </ol>
      ) : null}
      <p className="mt-2 text-[10px] text-muted-foreground">
        KYC counts are measured by Pi. This report is operator evidence only.
      </p>
    </section>
  )
}
