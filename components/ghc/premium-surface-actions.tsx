"use client"

/**
 * Shared header actions for Marketplace + Ecosystem.
 * Shown on primary product surfaces (not Wallet, which has its own chrome).
 */
import { LayoutGrid, ShoppingBag } from "lucide-react"

export function PremiumSurfaceActions({
  className = "",
  showLabels = false,
}: {
  className?: string
  showLabels?: boolean
}) {
  const openMarketplace = () => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:open-marketplace", { detail: {} }))
    } catch {
      /* */
    }
  }
  const openEcosystem = () => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:open-ecosystem", { detail: {} }))
    } catch {
      /* */
    }
  }

  const btn =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-2.5 text-foreground/90 shadow-sm transition hover:border-emerald-300/70 hover:bg-emerald-50/80 hover:text-emerald-900 active:scale-95 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

  return (
    <div className={`flex items-center gap-1.5 ${className}`} role="group" aria-label="GreenHaven surfaces">
      <button type="button" onClick={openMarketplace} className={btn} aria-label="Open Marketplace" title="Marketplace">
        <ShoppingBag size={16} aria-hidden />
        {showLabels ? <span className="text-[11px] font-bold">Market</span> : null}
      </button>
      <button type="button" onClick={openEcosystem} className={btn} aria-label="Open Ecosystem" title="Ecosystem">
        <LayoutGrid size={16} aria-hidden />
        {showLabels ? <span className="text-[11px] font-bold">Hub</span> : null}
      </button>
    </div>
  )
}
