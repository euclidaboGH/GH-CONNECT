"use client"

/**
 * Financial dashboard hero — bank-grade Available balance + Pending / Earned / Spent.
 * GHC only (never Pi). Official coin mark for currency.
 */

import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import { ASSET_POLICY } from "@/lib/asset-separation"
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
  const synced =
    lastSynced && Number.isFinite(lastSynced)
      ? new Date(lastSynced).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : null

  return (
    <section
      className="mx-3 mt-3 overflow-hidden rounded-[1.35rem] border border-emerald-900/10 bg-card shadow-[0_8px_30px_rgba(6,78,59,0.08)] dark:border-emerald-500/10 dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
      aria-label="GHC wallet balance"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 px-5 pb-6 pt-5 text-white">
        {/* soft light blobs — premium depth without noise */}
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 left-0 h-32 w-32 rounded-full bg-teal-300/15 blur-3xl"
          aria-hidden
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/75">
              Available
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-emerald-50/80">
              GreenHaven Coin · GHC · in-app utility
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GhcCoinIcon size={36} className="drop-shadow-md opacity-95" title="GreenHaven Coin" />
            <button
              type="button"
              onClick={onToggleVisible}
              className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-50 backdrop-blur-sm transition hover:bg-white/18 active:scale-95"
              aria-label={balanceVisible ? "Hide balance" : "Show balance"}
            >
              {balanceVisible ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <p className="relative mt-6 flex flex-wrap items-baseline gap-2 text-[2.35rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[2.6rem]">
          {refreshing && balance === 0 ? (
            <span className="inline-block h-10 w-40 animate-pulse rounded-lg bg-white/20" aria-label="Loading balance" />
          ) : (
            <>
              <span className="text-white">{mask(balance)}</span>
              {balanceVisible && (
                <span className="text-[0.95rem] font-bold tracking-wide text-emerald-100/70">GHC</span>
              )}
            </>
          )}
        </p>

        <div className="relative mt-3 flex flex-wrap items-center gap-2 text-[11px] text-emerald-100/65">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
            Ledger secured
          </span>
          {synced && <span>Synced {synced}</span>}
        </div>
      </div>

      <div
        className="grid grid-cols-3 divide-x divide-border/80 bg-gradient-to-b from-muted/40 to-card"
        role="group"
        aria-label="Balance summary"
      >
        <button
          type="button"
          onClick={onOpenPending}
          className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center transition hover:bg-amber-50/70 active:scale-[0.98] dark:hover:bg-amber-950/25"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pending</span>
          <span
            className={`text-[14px] font-bold tabular-nums ${
              pending > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground"
            }`}
          >
            {mask(pending)}
          </span>
          {pending > 0 && (
            <span className="text-[9px] font-semibold text-amber-600/90 dark:text-amber-400/90">Tap details</span>
          )}
        </button>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Earned</span>
          <span className="text-[14px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {mask(monthEarned)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Spent</span>
          <span className="text-[14px] font-bold tabular-nums text-foreground">{mask(monthSpent)}</span>
        </div>
      </div>
    </section>
  )
}
