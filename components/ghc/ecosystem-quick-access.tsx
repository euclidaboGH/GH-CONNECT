"use client"

/**
 * Visible shortcuts to Marketplace + GreenHaven Ecosystem.
 * Presentation only — opens existing overlays via navigateTo (no invented catalog).
 */

import { ShoppingBag, LayoutGrid, ChevronRight } from "lucide-react"
import { navigateTo } from "@/lib/navigation/navigate"

export function EcosystemQuickAccess({
  variant = "card",
  className = "",
}: {
  variant?: "card" | "compact" | "inline"
  className?: string
}) {
  const openMarketplace = () => {
    navigateTo("marketplace")
  }
  const openEcosystem = () => {
    navigateTo("ecosystem")
  }

  if (variant === "inline") {
    return (
      <div className={`flex gap-2 ${className}`} aria-label="GreenHaven services">
        <button
          type="button"
          onClick={openMarketplace}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 text-[11px] font-bold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <ShoppingBag size={14} aria-hidden />
          Market
        </button>
        <button
          type="button"
          onClick={openEcosystem}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 text-[11px] font-bold text-foreground transition hover:bg-muted"
        >
          <LayoutGrid size={14} aria-hidden />
          Ecosystem
        </button>
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div className={`grid grid-cols-2 gap-2 ${className}`} aria-label="GreenHaven services">
        <button
          type="button"
          onClick={openMarketplace}
          className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-card px-3 py-2.5 text-left shadow-sm transition hover:border-emerald-300 active:scale-[0.98] dark:border-emerald-900 dark:from-emerald-950/30"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <ShoppingBag size={16} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-bold text-foreground">Marketplace</span>
            <span className="block text-[10px] text-muted-foreground">Buy · sell · listings</span>
          </span>
        </button>
        <button
          type="button"
          onClick={openEcosystem}
          className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5 text-left shadow-sm transition hover:bg-muted/50 active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-emerald-700 dark:text-emerald-300">
            <LayoutGrid size={16} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-bold text-foreground">Ecosystem</span>
            <span className="block text-[10px] text-muted-foreground">All GH services</span>
          </span>
        </button>
      </div>
    )
  }

  return (
    <section
      className={`overflow-hidden rounded-[1.25rem] border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-card to-card p-3.5 shadow-[var(--gh-card-shadow)] dark:border-emerald-900/50 dark:from-emerald-950/25 ${className}`}
      aria-label="GreenHaven Marketplace and Ecosystem"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-300">
            GreenHaven services
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Marketplace and the full product ecosystem — always one tap away.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={openMarketplace}
          className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-white/80 px-3.5 py-3 text-left transition hover:border-emerald-400 hover:shadow-md active:scale-[0.99] dark:border-emerald-800 dark:bg-card"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <ShoppingBag size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-sm font-bold text-foreground">
              Marketplace
              <ChevronRight size={14} className="text-emerald-600" aria-hidden />
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Browse and manage listings
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={openEcosystem}
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white/80 px-3.5 py-3 text-left transition hover:border-emerald-200 hover:shadow-md active:scale-[0.99] dark:bg-card"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900">
            <LayoutGrid size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-sm font-bold text-foreground">
              Ecosystem
              <ChevronRight size={14} className="text-muted-foreground" aria-hidden />
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Wallet, rewards, membership & more
            </span>
          </span>
        </button>
      </div>
    </section>
  )
}
