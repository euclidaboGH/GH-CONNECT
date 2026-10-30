"use client"

import { ArrowLeft, RefreshCw } from "lucide-react"
import { formatWhen } from "./wallet-format"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"

/** Compact wallet chrome — max content, min chrome. */
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
    <header className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/95 px-2.5 py-1.5 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
        aria-label="Back"
      >
        <ArrowLeft size={17} strokeWidth={2.25} />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <GhcCoinIcon size={22} className="shrink-0" title="GreenHaven Coin" />
        <div className="min-w-0">
          <h1 className="truncate text-[14px] font-bold leading-tight tracking-tight text-foreground">
            GHC Wallet
          </h1>
          <p className="truncate text-[10px] leading-tight text-muted-foreground">
            Utility · not Pi
            {lastSynced ? ` · ${formatWhen(lastSynced)}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-60"
        aria-busy={refreshing}
        aria-label={refreshing ? "Refreshing" : "Refresh wallet"}
      >
        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} aria-hidden />
        {refreshing ? "…" : "Refresh"}
      </button>
      <p className="sr-only">{ASSET_POLICY.ghcRailsCopy}</p>
    </header>
  )
}
