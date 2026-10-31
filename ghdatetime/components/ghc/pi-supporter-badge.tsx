"use client"

/**
 * Ecosystem Directory Staking recognition badge (product signal only).
 * Does not grant financial privileges or bypass step-up / session rules.
 */

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import {
  fetchStakingStatus,
  stakeTierLabel,
  type StakeTierId,
  type StakingStatus,
} from "@/lib/pi-staking"

const TIER_STYLES: Record<
  Exclude<StakeTierId, "none">,
  string
> = {
  supporter: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  advocate: "bg-sky-50 text-sky-800 ring-sky-200",
  champion: "bg-violet-50 text-violet-900 ring-violet-200",
}

export function PiSupporterBadge({
  className = "",
  showCtaWhenNone = false,
}: {
  className?: string
  /** Show a subtle “Stake for GH CONNECT” hint when API available but no stake */
  showCtaWhenNone?: boolean
}) {
  const [status, setStatus] = useState<StakingStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchStakingStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!status) return null

  if (status.tier !== "none") {
    const style = TIER_STYLES[status.tier] || TIER_STYLES.supporter
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${style} ${className}`}
        title={
          status.effectiveStake != null
            ? `Effective stake: ${status.effectiveStake}`
            : "Directory supporter"
        }
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        {stakeTierLabel(status.tier)}
      </span>
    )
  }

  if (showCtaWhenNone && status.available) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border ${className}`}
        title="Stake Pi for GreenHaven in the Ecosystem Directory to earn recognition"
      >
        Support in Directory
      </span>
    )
  }

  // API not live yet — render nothing (no false claims)
  return null
}

/** Compact line for settings / about */
export function PiStakingStatusNote({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<StakingStatus | null>(null)
  useEffect(() => {
    void fetchStakingStatus().then(setStatus)
  }, [])
  if (!status) return null
  if (!status.available) {
    return (
      <p className={`text-[11px] text-muted-foreground ${className}`}>
        Directory staking recognition will unlock after Pi whitelist for the Staking
        Data API. Stake for GreenHaven in the Pi Browser Ecosystem Directory to support
        ranking.
      </p>
    )
  }
  return (
    <p className={`text-[11px] text-muted-foreground ${className}`}>
      Effective stake:{" "}
      <span className="font-semibold text-foreground">
        {status.effectiveStake ?? 0}
      </span>
      {status.tier !== "none" ? ` · ${stakeTierLabel(status.tier)}` : ""}
    </p>
  )
}
