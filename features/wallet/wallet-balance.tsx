"use client"

/**
 * Financial dashboard hero — Available balance + Pending / Earned / Spent.
 * GHC only (never Pi). Official coin mark for currency.
 * Visual treatment aligned to GreenHaven reference language (presentation only).
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
      className="mx-3 mt-3 overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-[var(--gh-card-shadow-lg)]"
      aria-label="GHC wallet balance"
    >
      {/* Premium balance hero — restrained gradient, strong hierarchy */}
      <div className="gh-balance-hero relative overflow-hidden px-5 pb-6 pt-5">
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-4 h-28 w-28 rounded-full bg-black/10 blur-2xl"
          aria-hidden
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
              <GhcCoinIcon size={36} className="drop-shadow-sm" title="GreenHaven Coin" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-white/80">
                Wallet Balance
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-white/60">
                GreenHaven Coin · GHC
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleVisible}
            className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
            aria-label={balanceVisible ? "Hide balance" : "Show balance"}
          >
            {balanceVisible ? "Hide" : "Show"}
          </button>
        </div>

        <p className="relative mt-5 flex flex-wrap items-baseline gap-2 text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[2.75rem]">
          {refreshing && balance === 0 ? (
            <span
              className="inline-block h-11 w-44 animate-pulse rounded-xl bg-white/20"
              aria-label="Loading balance"
            />
          ) : (
            <>
              <span className="text-white">{mask(balance)}</span>
              {balanceVisible && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[0.85rem] font-bold tracking-wide text-white/95">
                  GHC
                </span>
              )}
            </>
          )}
        </p>

        <div className="relative mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/65">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-0.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" aria-hidden />
            Ledger secured
          </span>
          {synced && <span>Synced {synced}</span>}
        </div>
      </div>

      {/* Summary strip */}
      <div
        className="grid grid-cols-3 divide-x divide-border/70 bg-card"
        role="group"
        aria-label="Balance summary"
      >
        <button
          type="button"
          onClick={onOpenPending}
          className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center transition hover:bg-amber-50/80 active:scale-[0.98] dark:hover:bg-amber-950/25"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Pending
          </span>
          <span
            className={`text-[15px] font-bold tabular-nums ${
              pending > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground"
            }`}
          >
            {mask(pending)}
          </span>
          {pending > 0 && (
            <span className="text-[9px] font-semibold text-amber-600/90 dark:text-amber-400/90">
              Tap details
            </span>
          )}
        </button>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Earned
          </span>
          <span className="text-[15px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {mask(monthEarned)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Spent
          </span>
          <span className="text-[15px] font-bold tabular-nums text-foreground">
            {mask(monthSpent)}
          </span>
        </div>
      </div>

      <p className="sr-only">{ASSET_POLICY.ghcRailsCopy}</p>
    </section>
  )
}
