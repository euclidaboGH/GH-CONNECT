"use client"

import { ArrowLeft, RefreshCw } from "lucide-react"
import { formatWhen } from "./wallet-format"
import { ASSET_POLICY } from "@/lib/asset-separation"

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
    <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
        aria-label="Back"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-bold text-foreground">GHC Wallet</h1>
        <p className="text-[11px] text-muted-foreground">
          GreenHaven utility · separate from Pi
          {lastSynced ? ` · synced ${formatWhen(lastSynced)}` : ""}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground/90">
          {ASSET_POLICY.ghcRailsCopy}
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground disabled:opacity-60"
      >
        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
        Refresh
      </button>
    </header>
  )
}
