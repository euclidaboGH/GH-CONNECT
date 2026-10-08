"use client"

import { ArrowLeft, RefreshCw } from "lucide-react"
import { formatWhen } from "./wallet-format"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"

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
    <header className="flex shrink-0 items-center gap-2.5 border-b border-border/60 bg-card/95 px-3 py-3 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
        aria-label="Back"
      >
        <ArrowLeft size={18} strokeWidth={2.25} />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <GhcCoinIcon size={28} className="shrink-0" title="GreenHaven Coin" />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold tracking-tight text-foreground">
            GHC Wallet
          </h1>
          <p className="truncate text-[11px] text-muted-foreground">
            GreenHaven utility · separate from Pi
            {lastSynced ? ` · ${formatWhen(lastSynced)}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm transition hover:bg-muted disabled:opacity-60"
        aria-busy={refreshing}
      >
        <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden />
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
      <p className="sr-only">{ASSET_POLICY.ghcRailsCopy}</p>
    </header>
  )
}
