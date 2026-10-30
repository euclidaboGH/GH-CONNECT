"use client"

/**
 * Unified wallet hero — authoritative GHC utility and PI earnings in one card.
 * Asset rails remain separate; PI shown here is the PI earnings ledger, not a
 * claim about the user's external Pi Wallet balance.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
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
  const [piSnapshot, setPiSnapshot] = useState<{
    available: number
    withdrawable: number
    pending: number
    reserved: number
    eligible: boolean
    piWalletLinked: boolean
    reasons: string[]
  } | null>(null)
  const [piLoading, setPiLoading] = useState(true)
  const [piFailed, setPiFailed] = useState(false)
  const piRequestRef = useRef<AbortController | null>(null)
  const piRequestIdRef = useRef(0)

  const refreshPi = useCallback(async () => {
    const requestId = ++piRequestIdRef.current
    piRequestRef.current?.abort()
    const controller = new AbortController()
    piRequestRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    setPiLoading(true)
    try {
      const response = await fetch("/api/economy/earnings/withdrawable", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as {
        ok?: boolean
        available?: number
        withdrawable?: number
        pending?: number
        reserved?: number
        eligible?: boolean
        piWalletLinked?: boolean
        reasons?: unknown
      } | null
      const validAmounts = [data?.available, data?.withdrawable, data?.pending, data?.reserved]
        .every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)
      if (!response.ok || data?.ok !== true || !validAmounts || typeof data.eligible !== "boolean" || typeof data.piWalletLinked !== "boolean") {
        if (requestId === piRequestIdRef.current) { setPiSnapshot(null); setPiFailed(true) }
        return
      }
      if (requestId === piRequestIdRef.current) {
        setPiSnapshot({
          available: data.available!,
          withdrawable: data.withdrawable!,
          pending: data.pending!,
          reserved: data.reserved!,
          eligible: data.eligible,
          piWalletLinked: data.piWalletLinked,
          reasons: Array.isArray(data.reasons) ? data.reasons.filter((reason): reason is string => typeof reason === "string") : [],
        })
        setPiFailed(false)
      }
    } catch {
      if (requestId === piRequestIdRef.current) { setPiSnapshot(null); setPiFailed(true) }
    } finally {
      window.clearTimeout(timeout)
      if (requestId === piRequestIdRef.current) {
        setPiLoading(false)
        piRequestRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    void refreshPi()
    const onRefresh = () => void refreshPi()
    window.addEventListener("ghc:wallet-refresh", onRefresh)
    window.addEventListener("ghc:earnings-refresh", onRefresh)
    window.addEventListener("ghc:wallet-synced", onRefresh)
    return () => {
      piRequestIdRef.current += 1
      piRequestRef.current?.abort()
      piRequestRef.current = null
      window.removeEventListener("ghc:wallet-refresh", onRefresh)
      window.removeEventListener("ghc:earnings-refresh", onRefresh)
      window.removeEventListener("ghc:wallet-synced", onRefresh)
    }
  }, [refreshPi])

  const mask = (n: number) => (balanceVisible ? formatGhc(n) : "••••")
  const maskPi = (n: number) => balanceVisible ? `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} π` : "••••"
  const synced =
    lastSynced && Number.isFinite(lastSynced)
      ? new Date(lastSynced).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : null

  return (
    <section
      className="gh-reference-panel mx-3 mt-3 overflow-hidden"
      aria-label="Unified PI and GHC wallet balances"
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
              <p className="text-[11px] font-semibold tracking-wide text-white/80">GreenHaven Wallet</p>
              <p className="mt-0.5 text-[10px] font-medium text-white/60">PI earnings + GHC utility · separate balances</p>
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

        <div className="relative mt-4">
          <p className="text-sm font-bold text-white">Your assets, clearly separated</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/75">
            Each balance comes from its own authoritative ledger. PI and GHC are never added together.
          </p>
        </div>

        {primaryActions ? (
          <div className="relative mt-5 border-t border-white/15 pt-3">{primaryActions}</div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-border/60 bg-card p-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-violet-200/80 bg-violet-50/70 p-3 dark:border-violet-900/70 dark:bg-violet-950/25" aria-label="PI earnings ledger balance">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-lg font-black text-white" aria-hidden="true">π</span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-violet-950 dark:text-violet-100">PI earnings</p>
              <p className="text-[10px] text-violet-800/80 dark:text-violet-200/80">PI · ledger balance</p>
            </div>
          </div>
          <p className="mt-3 text-xl font-black tabular-nums text-violet-950 dark:text-violet-100">
            {piLoading ? "Loading…" : piSnapshot ? maskPi(piSnapshot.available) : "Unavailable"}
          </p>
          <p className="mt-1 text-[10px] text-violet-800/80 dark:text-violet-200/80">
            {piLoading ? "Checking authoritative ledger" : piSnapshot ? `${maskPi(piSnapshot.withdrawable)} withdrawable · fees and eligibility apply` : piFailed ? "Could not verify PI earnings." : "No verified PI earnings snapshot."}
          </p>
          {piSnapshot ? (
            <p className="mt-1 text-[10px] font-semibold text-violet-800 dark:text-violet-200">
              {!piSnapshot.piWalletLinked ? "Link your Pi identity before requesting a payout." : piSnapshot.eligible ? "Currently eligible for payout, subject to server-side quote and checks." : `Not currently eligible: ${piSnapshot.reasons.includes("BELOW_MIN_PAYOUT") ? "minimum payout not reached" : piSnapshot.reasons.includes("NO_AVAILABLE_BALANCE") ? "no available balance" : "additional payout requirements apply"}.`}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void refreshPi()}
            disabled={piLoading}
            className="mt-2 rounded-full border border-violet-300/80 px-3 py-1 text-[10px] font-bold text-violet-900 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60 dark:border-violet-800 dark:text-violet-100 dark:hover:bg-violet-900/40"
            aria-label="Refresh authoritative PI earnings balance"
          >
            {piLoading ? "Refreshing…" : "Refresh PI balance"}
          </button>
          {piSnapshot && (piSnapshot.pending > 0 || piSnapshot.reserved > 0) ? (
            <p className="mt-1 text-[10px] text-violet-800/80 dark:text-violet-200/80">
              {piSnapshot.pending > 0 ? `${maskPi(piSnapshot.pending)} pending` : ""}{piSnapshot.pending > 0 && piSnapshot.reserved > 0 ? " · " : ""}{piSnapshot.reserved > 0 ? `${maskPi(piSnapshot.reserved)} reserved` : ""}
            </p>
          ) : null}
        </section>
        <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/25" aria-label="GHC utility balance">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700/10">
              <GhcCoinIcon size={30} title="GreenHaven Coin" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">GHC utility</p>
              <p className="text-[10px] text-emerald-800/80 dark:text-emerald-200/80">GHC · in-app utility</p>
            </div>
          </div>
          <p className="mt-3 text-xl font-black tabular-nums text-emerald-950 dark:text-emerald-100">{mask(balance)} GHC</p>
          <p className="mt-1 text-[10px] text-emerald-800/80 dark:text-emerald-200/80">{refreshing ? "Refreshing authoritative wallet" : synced ? `Updated ${synced}` : "Available utility balance"}</p>
        </section>
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
