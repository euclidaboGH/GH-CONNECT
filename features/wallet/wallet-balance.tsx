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
      className="gh-reference-panel mx-3 mt-3 overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-[var(--gh-card-shadow)]"
      aria-label="Unified PI and GHC wallet balances"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-emerald-50/80 via-card to-violet-50/60 px-4 py-3.5 dark:from-emerald-950/30 dark:via-card dark:to-violet-950/25">
        <div className="min-w-0">
          <p className="text-[14px] font-bold tracking-tight text-foreground">GreenHaven Wallet</p>
          <p className="text-[11px] text-muted-foreground">
            PI earnings · GHC utility · separate ledgers
            {synced ? ` · ${synced}` : ""}
            {refreshing ? " · refreshing…" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleVisible}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition hover:bg-muted"
          aria-label={balanceVisible ? "Hide balances" : "Show balances"}
        >
          {balanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {/* Dual asset rows */}
      <div className="divide-y divide-border/50" role="listbox" aria-label="Select asset">
        <button
          type="button"
          role="option"
          aria-selected={piSelected}
          onClick={() => onSelectRail?.("pi")}
          className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
            piSelected ? "bg-violet-50/90 dark:bg-violet-950/35" : "hover:bg-muted/40"
          }`}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-lg font-black text-white shadow-sm"
            aria-hidden
          >
            π
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-bold text-foreground">PI</p>
              <p className="text-[17px] font-black tabular-nums text-foreground">
                {piLoading ? (
                  <Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" />
                ) : piSnapshot ? (
                  maskPi(piSnapshot.available)
                ) : (
                  "—"
                )}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {piLoading
                ? "Loading earnings ledger…"
                : piSnapshot
                  ? `${maskPi(piSnapshot.withdrawable)} withdrawable · fees and eligibility apply`
                  : piFailed
                    ? "Unavailable — could not verify PI earnings"
                    : "PI earnings ledger"}
            </p>
          </div>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${piSelected ? "bg-violet-600" : "bg-border"}`}
            aria-hidden
          />
        </button>


      {/* PI status + retry — fail-closed, no invented zeros */}
      {piSelected ? (
        <div className="space-y-2 border-b border-border/50 bg-violet-50/40 px-4 py-2.5 dark:bg-violet-950/20">
          {piSnapshot ? (
            <>
              <p className="text-[11px] text-violet-900 dark:text-violet-100">
                {piSnapshot.eligible
                  ? "Eligible for payout subject to server quote and checks."
                  : piSnapshot.reasons.includes("BELOW_MIN_PAYOUT")
                    ? "Not currently eligible: minimum payout not reached."
                    : piSnapshot.reasons.includes("NO_AVAILABLE_BALANCE")
                      ? "Not currently eligible: no available balance."
                      : "Not currently eligible: additional payout requirements apply."}
              </p>
              <p className="text-[11px] font-semibold text-violet-900 dark:text-violet-100">
                {!piSnapshot.piWalletLinked
                  ? "Link your Pi identity before requesting a payout."
                  : "Pi identity linked for payouts."}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {piFailed ? "Unavailable" : "No verified PI earnings snapshot."}
            </p>
          )}
          <button
            type="button"
            onClick={() => void refreshPi()}
            disabled={piLoading}
            className="rounded-full border border-violet-300/80 px-3 py-1 text-[10px] font-bold text-violet-900 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60 dark:border-violet-800 dark:text-violet-100"
            aria-label="Refresh PI balance"
          >
            {piLoading ? "Refreshing…" : "Refresh PI balance"}
          </button>
        </div>
      ) : null}

        <button
          type="button"
          role="option"
          aria-selected={ghcSelected}
          onClick={() => onSelectRail?.("ghc")}
          className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
            ghcSelected ? "bg-emerald-50/90 dark:bg-emerald-950/30" : "hover:bg-muted/40"
          }`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-700/15 ring-1 ring-emerald-600/20">
            <GhcCoinIcon size={28} title="GreenHaven Coin" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-bold text-foreground">GHC</p>
              <p className="text-[17px] font-black tabular-nums text-foreground">{mask(balance)}</p>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              In-app utility
              {pending > 0 ? ` · ${mask(pending)} pending` : ""}
              {locked > 0 ? ` · ${mask(locked)} reserved` : ""}
            </p>
          </div>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${ghcSelected ? "bg-emerald-600" : "bg-border"}`}
            aria-hidden
          />
        </button>
      </div>

      {/* Shared primary actions */}
      {primaryActions ? (
        <div className="border-t border-border/60 bg-muted/20 px-2 py-2.5">{primaryActions}</div>
      ) : null}

      {/* Compact footer metrics */}
      <div className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/40">
        <button
          type="button"
          onClick={onOpenPending}
          className="bg-card px-3 py-2.5 text-left transition hover:bg-muted/50"
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">This month (GHC)</p>
          <p className="mt-0.5 text-[12px] font-bold tabular-nums text-foreground">
            +{mask(monthEarned)} / −{mask(monthSpent)}
          </p>
        </button>
        <div className="bg-card px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Rails</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">PI and GHC are never added together</p>
        </div>
      </div>

      <p className="sr-only">
        {ASSET_POLICY.ghcRailsCopy} {ASSET_POLICY.piRailsCopy}
      </p>
    </section>
  )
}
