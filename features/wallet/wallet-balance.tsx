"use client"

/**
 * Financial dashboard hero — Available balance + Pending / Earned / Spent.
 * GHC only (never Pi). Official coin mark for currency.
 */

import type { ReactNode } from "react"
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
  locked,
  monthEarned,
  monthSpent,
  onOpenPending,
  primaryActions,
}: {
  balance: number
  balanceVisible: boolean
  onToggleVisible: () => void
  refreshing: boolean
  lastSynced?: number | null
  pending: number
  locked: number
  monthEarned: number
  monthSpent: number
  onOpenPending: () => void
  /** Optional action row (Send / Request / Receive / History) attached under the card */
  primaryActions?: ReactNode
}) {
  const mask = (n: number) => (balanceVisible ? formatGhc(n) : "••••")
  const synced =
    lastSynced && Number.isFinite(lastSynced)
      ? new Date(lastSynced).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : null

  return (
    <section
      className="gh-reference-panel mx-3 mt-3 overflow-hidden"
      aria-label="GHC wallet balance"
    >
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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
              <GhcCoinIcon size={40} className="drop-shadow-sm" title="GreenHaven Coin" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-white/80">Wallet Balance</p>
              <p className="mt-0.5 text-[10px] font-medium text-white/60">GreenHaven Coin · GHC</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleVisible}
            className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/95 backdrop-blur-sm"
            aria-label={balanceVisible ? "Hide balance" : "Show balance"}
          >
            {balanceVisible ? "Hide" : "Show"}
          </button>
        </div>

        <div className="relative mt-5">
          <p className="text-[2.15rem] font-black leading-none tracking-tight text-white tabular-nums">
            {mask(balance)}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-white/75">
            {refreshing ? "Refreshing…" : synced ? `Updated ${synced}` : "Available balance"}
          </p>
        </div>

        {primaryActions ? (
          <div className="relative mt-5 border-t border-white/15 pt-3">{primaryActions}</div>
        ) : null}
      </div>

      <div className="grid grid-cols-4 divide-x divide-border/50 border-t border-border/60 bg-card">
        <button
          type="button"
          onClick={onOpenPending}
          className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center transition hover:bg-muted/40"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pending</span>
          <span
            className={`text-[15px] font-bold tabular-nums ${
              pending > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground"
            }`}
          >
            {mask(pending)}
          </span>
          {pending > 0 ? (
            <span className="text-[9px] font-semibold text-amber-600/90 dark:text-amber-400/90">Tap details</span>
          ) : null}
        </button>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Reserved</span>
          <span className="text-[15px] font-bold tabular-nums text-foreground">{mask(locked)}</span>
          {locked > 0 ? <span className="text-[9px] text-muted-foreground">Not spendable</span> : null}
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Earned</span>
          <span className="text-[15px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {mask(monthEarned)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2 py-3.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Spent</span>
          <span className="text-[15px] font-bold tabular-nums text-foreground">{mask(monthSpent)}</span>
        </div>
      </div>

      <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5">
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">GHC</span> is spendable in-app utility
          {pending > 0 ? " · pending may wait up to ~48h before claim" : ""}
          {locked > 0 ? " · reserved is not spendable" : ""}.{" "}
          <span className="font-semibold text-foreground">π</span> stays on the Pi payment rail — not mixed into this
          balance.
        </p>
        <p className="sr-only">
          {ASSET_POLICY.ghcRailsCopy} {ASSET_POLICY.piRailsCopy}
        </p>
      </div>
    </section>
  )
}
