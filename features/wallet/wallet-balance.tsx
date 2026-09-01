"use client"

/**
 * Financial dashboard hero — Available first, then Pending / Earned / Spent.
 * GHC only (never Pi). Official coin mark for currency, not identity.
 */

import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import { formatGhc } from "./wallet-format"

export function WalletBalanceCard({
  balance,
  balanceVisible,
  onToggleVisible,
  refreshing,
  lastSynced,
  pending,
  monthEarned,
  monthSpent,
  onOpenPending,
}: {
  balance: number
  balanceVisible: boolean
  onToggleVisible: () => void
  refreshing: boolean
  lastSynced?: number | null
  pending: number
  monthEarned: number
  monthSpent: number
  onOpenPending: () => void
}) {
  const mask = (n: number) => (balanceVisible ? formatGhc(n) : "••••")

  return (
    <section
      className="mx-3 mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      aria-label="GHC wallet balance"
    >
      {/* Primary: Available */}
      <div className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 px-5 pb-5 pt-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/80">
              GHC Wallet
            </p>
            <p className="mt-1 text-[11px] font-medium text-emerald-100/70">
              Available balance · GreenHaven Coin
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GhcCoinIcon size={40} className="opacity-95" title="GreenHaven Coin" />
            <button
              type="button"
              onClick={onToggleVisible}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-50 transition hover:bg-white/15"
              aria-label={balanceVisible ? "Hide balance" : "Show balance"}
            >
              {balanceVisible ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <p className="mt-5 flex flex-wrap items-baseline gap-2 text-[36px] font-semibold leading-none tracking-tight tabular-nums sm:text-[40px]">
          {refreshing && balance === 0 ? (
            <span
              className="inline-block h-10 w-36 animate-pulse rounded bg-white/20"
              aria-label="Loading balance"
            />
          ) : (
            <>
              <span>{balanceVisible ? formatGhc(balance) : "••••••"}</span>
              <span className="text-lg font-semibold text-emerald-100/90">GHC</span>
            </>
          )}
        </p>
        <p className="mt-2 text-[11px] font-medium text-emerald-100/65">
          Internal utility on GreenHaven · not Pi Network coin
        </p>
      </div>

      {/* Secondary metrics strip */}
      <div
        className="grid grid-cols-3 divide-x divide-border border-t border-border bg-muted/30"
        role="group"
        aria-label="Balance summary"
      >
        <button
          type="button"
          onClick={onOpenPending}
          className="flex flex-col items-center gap-0.5 px-2 py-3 text-center transition hover:bg-amber-50/60 dark:hover:bg-amber-950/20"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Pending
          </span>
          <span
            className={`text-[14px] font-bold tabular-nums ${
              pending > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground"
            }`}
          >
            {mask(pending)}
          </span>
        </button>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Earned
          </span>
          <span className="text-[14px] font-bold tabular-nums text-foreground">
            {mask(monthEarned)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Spent
          </span>
          <span className="text-[14px] font-bold tabular-nums text-foreground">
            {mask(monthSpent)}
          </span>
        </div>
      </div>
    </section>
  )
}
