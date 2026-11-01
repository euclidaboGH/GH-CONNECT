"use client"

import { ArrowLeft, RefreshCw } from "lucide-react"
import { formatWhen } from "./wallet-format"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"

/** Dual-asset wallet chrome — PI + GHC, max content, min chrome. */
export function WalletHeader({
  onBack,
  onRefresh,
  refreshing,
  lastSynced,
}: {
  onBack: () => void
  onRefresh: () => void
  refreshing: boolean
  lastSynced?: number | null
}) {
  return (
    <header className="sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b border-border/40 bg-background/88 px-3 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground shadow-sm transition hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="Back"
      >
        <ArrowLeft size={18} strokeWidth={2.25} />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex -space-x-1.5" aria-hidden>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white shadow-sm ring-2 ring-card">
            π
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 shadow-sm ring-2 ring-card">
            <GhcCoinIcon size={16} className="text-white" title="" />
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-foreground">
            Wallet
          </h1>
          <p className="truncate text-[10px] leading-tight text-muted-foreground">
            PI · GHC · separate ledgers
            {lastSynced ? ` · ${formatWhen(lastSynced)}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-border/70 bg-card px-3 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-60"
        aria-busy={refreshing}
        aria-label={refreshing ? "Refreshing" : "Refresh wallet"}
      >
        <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden />
        {refreshing ? "…" : "Refresh"}
      </button>
      <p className="sr-only">{ASSET_POLICY.ghcRailsCopy}</p>
    </header>
  )
}
