"use client"

/**
 * Dual-asset wallet hero — PI earnings and GHC utility in one professional card.
 * Rails stay separate; shared Send / Request / Receive / History actions sit below.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { formatGhc } from "./wallet-format"

export type WalletAssetRail = "pi" | "ghc"

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
  selectedRail = "ghc",
  onSelectRail,
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
  primaryActions?: ReactNode
  selectedRail?: WalletAssetRail
  onSelectRail?: (rail: WalletAssetRail) => void
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
  const [walletOnline, setWalletOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  )
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
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean
        available?: number
        withdrawable?: number
        pending?: number
        reserved?: number
        eligible?: boolean
        piWalletLinked?: boolean
        reasons?: unknown
      } | null
      const validAmounts = [data?.available, data?.withdrawable, data?.pending, data?.reserved].every(
        (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
      )
      if (!response.ok || !data || data.ok !== true || !validAmounts || typeof data.eligible !== "boolean") {
        if (requestId === piRequestIdRef.current) {
          setPiSnapshot(null)
          setPiFailed(true)
        }
        return
      }
      if (requestId === piRequestIdRef.current) {
        setPiSnapshot({
          available: Number(data.available),
          withdrawable: Number(data.withdrawable),
          pending: Number(data.pending),
          reserved: Number(data.reserved),
          eligible: data.eligible === true,
          piWalletLinked: data.piWalletLinked === true,
          reasons: Array.isArray(data.reasons) ? data.reasons.map(String) : [],
        })
        setPiFailed(false)
      }
    } catch {
      if (requestId === piRequestIdRef.current) {
        setPiSnapshot(null)
        setPiFailed(true)
      }
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
    const onOnline = () => setWalletOnline(true)
    const onOffline = () => setWalletOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      piRequestIdRef.current += 1
      piRequestRef.current?.abort()
      piRequestRef.current = null
      window.removeEventListener("ghc:wallet-refresh", onRefresh)
      window.removeEventListener("ghc:earnings-refresh", onRefresh)
      window.removeEventListener("ghc:wallet-synced", onRefresh)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [refreshPi])

  const mask = (n: number) => (balanceVisible ? formatGhc(n) : "••••")
  const maskPi = (n: number) =>
    balanceVisible
      ? `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} π`
      : "••••"
  const synced =
    lastSynced && Number.isFinite(lastSynced)
      ? new Date(lastSynced).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : null

  const piSelected = selectedRail === "pi"
  const ghcSelected = selectedRail === "ghc"

  return (
    <section
      className="gh-reference-panel mx-3 mt-3 overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-[var(--gh-card-shadow)]"
      aria-label="Unified PI and GHC wallet balances" aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-emerald-50/90 via-card to-violet-50/70 px-4 py-3.5 dark:from-emerald-950/35 dark:via-card dark:to-violet-950/30">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold tracking-tight text-foreground">Wallet</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">
              PI earnings · GHC utility · separate ledgers
              {synced ? ` · ${synced}` : ""}
            </p>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                !walletOnline
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
                  : refreshing
                    ? "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
              }`}
              role="status"
              aria-live="polite"
            >
              {!walletOnline ? "Offline · showing last verified" : refreshing ? "Syncing…" : "Live"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleVisible}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-sm transition hover:bg-muted"
          aria-label={balanceVisible ? "Hide balances" : "Show balances"}
        >
          {balanceVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {/* Dual asset grid — bank / crypto wallet class */}
      <div className="grid grid-cols-2 gap-0 divide-x divide-border/60" role="listbox" aria-label="Select asset">
        <button
          type="button"
          role="option"
          aria-selected={piSelected}
          onClick={() => onSelectRail?.("pi")}
          className={`relative flex flex-col gap-2 px-4 py-4 text-left transition ${
            piSelected
              ? "bg-violet-50/95 ring-2 ring-inset ring-violet-500/40 dark:bg-violet-950/40"
              : "hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-base font-black text-white shadow-sm" aria-hidden>
              π
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-foreground">PI</p>
              <p className="text-[10px] text-muted-foreground">Earnings</p>
            </div>
          </div>
          <p className="text-[22px] font-black tabular-nums leading-none tracking-tight text-foreground">
            {piLoading ? (
              <Loader2 className="inline h-5 w-5 animate-spin text-muted-foreground" />
            ) : piSnapshot ? (
              maskPi(piSnapshot.available)
            ) : piFailed ? (
              "Unavailable"
            ) : (
              "Unavailable"
            )}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {piLoading
              ? "Loading ledger…"
              : piFailed
                ? "PI balance unavailable — refresh to retry"
                : piSnapshot?.piWalletLinked
                  ? piSnapshot.eligible
                    ? "Pi identity linked · payout eligible"
                    : "Pi identity linked · payout not currently eligible"
                  : "Link your Pi identity to enable withdrawals"}
          </p>
          {piSelected ? (
            <span className="absolute right-2 top-2 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              Active
            </span>
          ) : null}
        </button>

        <button
          type="button"
          role="option"
          aria-selected={!piSelected}
          onClick={() => onSelectRail?.("ghc")}
          className={`relative flex flex-col gap-2 px-4 py-4 text-left transition ${
            !piSelected
              ? "bg-emerald-50/95 ring-2 ring-inset ring-emerald-500/40 dark:bg-emerald-950/40"
              : "hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 shadow-sm" aria-hidden>
              <GhcCoinIcon size={18} className="text-white" title="" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-foreground">GHC</p>
              <p className="text-[10px] text-muted-foreground">Utility</p>
            </div>
          </div>
          <p className="text-[22px] font-black tabular-nums leading-none tracking-tight text-foreground">
            {balanceVisible ? formatGhc(balance) : "••••"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {pending > 0 || locked > 0
              ? `${formatGhc(pending)} pending · ${formatGhc(locked)} locked`
              : "Available to spend"}
          </p>
          {!piSelected ? (
            <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              Active
            </span>
          ) : null}
        </button>
      </div>

      {/* Meta strip for active rail */}
      <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5">
        {piSelected ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              Withdrawable{" "}
              <strong className="text-foreground">
                {piSnapshot ? maskPi(piSnapshot.withdrawable) : "—"}
              </strong>
            </span>
            <span>
              Pending{" "}
              <strong className="text-foreground">
                {piSnapshot ? maskPi(piSnapshot.pending) : "—"}
              </strong>
            </span>
            <span>withdrawable · fees and eligibility apply</span>
            <button
              type="button"
              onClick={() => void refreshPi()}
              disabled={piLoading}
              className="font-semibold text-violet-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh PI balance"
            >
              {piLoading ? "Refreshing PI…" : "Refresh PI balance"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <button type="button" onClick={onOpenPending} className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
              Pending {formatGhc(pending)}
            </button>
            <span>
              Month in <strong className="text-foreground">{formatGhc(monthEarned)}</strong>
            </span>
            <span>
              Month out <strong className="text-foreground">{formatGhc(monthSpent)}</strong>
            </span>
          </div>
        )}
      </div>

      {primaryActions ? (
        <div className="border-t border-border/60 px-3 py-3">{primaryActions}</div>
      ) : null}

      <p className="sr-only">
        PI and GHC are never added together. GHC utility and PI earnings remain separate assets and separate ledgers.
        {" "}{ASSET_POLICY.ghcRailsCopy} {ASSET_POLICY.piRailsCopy}
      </p>
    </section>
  )
}
