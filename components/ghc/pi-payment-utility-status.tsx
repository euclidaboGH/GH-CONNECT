"use client"

/**
 * Phase 3 — shows whether π fee rails are configured for sandbox proof.
 */

import { useEffect, useState } from "react"
import { Coins } from "lucide-react"

type Status = {
  piOnlyCommerce?: boolean
  piApiKeyConfigured?: boolean
  railsReadyForSandboxProof?: boolean
  listingFeeSample?: { amount: number; currency: string; requiresSettlement?: boolean }
  communityCreateFeeSample?: { amount: number; currency: string; requiresSettlement?: boolean }
  openIntentsForUser?: number
  sandboxSteps?: string[]
  note?: string
}

export function PiPaymentUtilityStatus({ className = "" }: { className?: string }) {
  const [s, setS] = useState<Status | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/payments/utility-status", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.ok) setS(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!s) return null

  return (
    <section className={`rounded-2xl border border-border/60 bg-card p-4 ${className}`} aria-label="Pi payment utility">
      <div className="mb-2 flex items-center gap-2">
        <Coins size={16} className="text-amber-600" />
        <h3 className="text-sm font-bold text-foreground">π payment utility (sandbox proof)</h3>
      </div>
      <ul className="space-y-1 text-[11px] text-muted-foreground">
        <li>
          Pi-only commerce:{" "}
          <span className="font-semibold text-foreground">{s.piOnlyCommerce ? "on" : "off"}</span>
        </li>
        <li>
          PI_API_KEY:{" "}
          <span className="font-semibold text-foreground">{s.piApiKeyConfigured ? "configured" : "missing"}</span>
        </li>
        <li>
          Listing fee sample:{" "}
          <span className="font-semibold text-foreground">
            {s.listingFeeSample?.amount} {s.listingFeeSample?.currency}
          </span>
        </li>
        <li>
          Community create fee sample:{" "}
          <span className="font-semibold text-foreground">
            {s.communityCreateFeeSample?.amount} {s.communityCreateFeeSample?.currency}
          </span>
        </li>
        <li>
          Rails ready for sandbox proof:{" "}
          <span className="font-semibold text-foreground">{s.railsReadyForSandboxProof ? "yes" : "not yet"}</span>
        </li>
        {typeof s.openIntentsForUser === "number" && s.openIntentsForUser >= 0 ? (
          <li>
            Open intents (you): <span className="font-semibold text-foreground">{s.openIntentsForUser}</span>
          </li>
        ) : null}
      </ul>
      {s.sandboxSteps?.length ? (
        <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[10px] text-muted-foreground">
          {s.sandboxSteps.map((step) => (
            <li key={step.slice(0, 24)}>{step}</li>
          ))}
        </ol>
      ) : null}
      {s.note ? <p className="mt-2 text-[10px] text-muted-foreground">{s.note}</p> : null}
    </section>
  )
}
