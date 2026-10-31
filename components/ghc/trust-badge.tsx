"use client"

/**
 * Trust / reputation badge — event-derived only, not purchasable with GHC.
 * Never invents verification; shows tier from reputation domain when available.
 */

import { useEffect, useState } from "react"
import { Shield } from "lucide-react"
import { getBoundDomainServices } from "@/lib/domains/compat"

type Tier = "new" | "emerging" | "trusted" | "established" | "exemplary" | string

const TIER_STYLE: Record<string, string> = {
  exemplary: "bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-100",
  established: "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100",
  trusted: "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-100",
  emerging: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100",
  new: "bg-muted text-muted-foreground ring-border",
}

const TIER_LABEL: Record<string, string> = {
  exemplary: "Exemplary",
  established: "Established",
  trusted: "Trusted",
  emerging: "Emerging",
  new: "New",
}

export function TrustBadge({
  userId,
  className = "",
  showWhenNew = false,
}: {
  userId?: string | null
  className?: string
  showWhenNew?: boolean
}) {
  const [tier, setTier] = useState<Tier | null>(null)
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    const id = String(userId || "").trim()
    if (!id) return
    try {
      const rep = getBoundDomainServices()?.reputation as {
        getSnapshot?: (uid: string) => { tier?: string; score?: number } | null
      } | null
      const snap = rep?.getSnapshot?.(id)
      if (snap?.tier) {
        setTier(snap.tier)
        setScore(typeof snap.score === "number" ? snap.score : null)
      } else {
        setTier(showWhenNew ? "new" : null)
      }
    } catch {
      setTier(null)
    }
  }, [userId, showWhenNew])

  if (!tier) return null
  if (tier === "new" && !showWhenNew) return null

  const style = TIER_STYLE[tier] || TIER_STYLE.new
  const label = TIER_LABEL[tier] || String(tier)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${style} ${className}`}
      title={
        score != null
          ? `Trust tier: ${label} (score ${score}). Derived from verified activity — not for sale.`
          : `Trust tier: ${label}. Derived from verified activity — not for sale.`
      }
    >
      <Shield className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
