"use client"

/**
 * GHC as social fuel — never casino framing.
 * Use near rewards, wallet about, community quality loops.
 */

import { GhcCoinIcon } from "./ghc-coin-icon"
import { labels } from "@/lib/i18n/labels"

export function GhcSocialFuelNote({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[10px] leading-snug text-muted-foreground">
        {labels.ghc.socialFuel} {labels.ghc.utility}
      </p>
    )
  }

  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <GhcCoinIcon size={22} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-100">GreenHaven Coin · social fuel</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-800/90 dark:text-emerald-200/80">
          {labels.ghc.socialFuel} Approved helpful posts, mentorship, and community leadership can earn GHC under
          limits — <strong>never</strong> for spam likes or self-interaction.
        </p>
        <p className="mt-1 text-[10px] text-emerald-700/80 dark:text-emerald-300/70">{labels.ghc.utility}</p>
      </div>
    </div>
  )
}
