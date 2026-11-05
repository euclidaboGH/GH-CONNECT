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
  ghcVerified = false,
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
  /** True only for a server-sourced, validated wallet snapshot. */
  ghcVerified?: boolean
}) {
  const [piSnapshot, setPiSnapshot] = useState<{
    available: number
    withdrawable: number
    pending: number
    reserved: number
    eligible: boolean
    economyEligible: boolean
    authorizationActive: boolean
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
        walletAuthorization?: {
          active?: boolean
          authorizationActive?: boolean
          uidMatchesAuthorization?: boolean
        } | null
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
      const authActive =
        data.walletAuthorization?.active === true ||
        (data.walletAuthorization?.authorizationActive === true &&
          data.walletAuthorization?.uidMatchesAuthorization === true)
      if (requestId === piRequestIdRef.current) {
        setPiSnapshot({
          available: Number(data.available),
          withdrawable: Number(data.withdrawable),
          pending: Number(data.pending),
          reserved: Number(data.reserved),
          // Economy-eligible alone is not payout-ready; require explicit A2U consent.
          eligible: data.eligible === true && authActive === true,
          economyEligible: data.eligible === true,
          authorizationActive: authActive === true,
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
      className="gh-reference-panel mx-3 mt-3 overflow-hidden rounded-[1.75rem] border border-white/15 bg-[linear-gradient(145deg,rgba(16,185,129,0.12),rgba(255,255,255,0.98)_38%,rgba(124,58,237,0.10))] shadow-[0_20px_55px_-28px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.03] dark:bg-[linear-gradient(145deg,rgba(16,185,129,0.14),rgba(15,23,42,0.96)_42%,rgba(124,58,237,0.14))] dark:ring-white/[0.05]"
      aria-label="Unified PI and GHC wallet balances; Pi and GHC remain separate"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-white/45 px-4 py-4 backdrop-blur-xl dark:bg-white/[0.025]">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Portfolio</p>
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
                    : ghcVerified
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
                      : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
              }`}
              role="status"
              aria-live="polite"
            >
              {!walletOnline ? "Offline · last snapshot only" : refreshing ? "Syncing…" : ghcVerified ? "Confirmed" : "Not confirmed"}
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

      {/* Premium active-asset hero. The selected rail is displayed alone; PI and GHC are never combined. */}
      <div className="mx-3 mt-3 overflow-hidden rounded-[1.45rem] border border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(212,175,55,0.28),transparent_30%),linear-gradient(135deg,#062f35_0%,#0a3d62_58%,#075b50_100%)] p-4 text-white shadow-[0_20px_48px_-25px_rgba(6,47,53,0.8)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/65">{piSelected ? "Pi earnings balance" : "GreenHaven wallet"}</p>
            <p className="mt-1 text-[11px] text-white/75">{piSelected ? "Pi · separate from GHC" : "GHC · GreenHaven Coin"}</p>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/90">
            {piSelected ? (piLoading ? "Checking" : piFailed ? "Unavailable" : "Pi rail") : "GHC rail"}
          </span>
        </div>
        <p className="mt-4 break-words text-[clamp(1.9rem,8vw,2.65rem)] font-black leading-none tracking-tight tabular-nums" aria-live="polite">
          {piSelected
            ? piSnapshot
              ? maskPi(piSnapshot.available)
              : piLoading
                ? "Checking…"
                : "Unavailable"
            : ghcVerified ? mask(balance) : "Unavailable"}
        </p>
        <p className="mt-2 text-[10px] text-white/65">
          {piSelected
            ? piLoading
              ? "Securely checking the authoritative earnings ledger"
              : piFailed
                ? "No fresh balance available. Use refresh to try again."
                : piSnapshot?.piWalletLinked
                  ? "Server-reported balance · Pi identity linked"
                  : "Server-reported balance · Pi identity not linked"
            : ghcVerified
              ? "Available GHC balance · server-confirmed snapshot"
              : "GHC balance not confirmed · retry when the ledger is available"}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-3">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wide text-white/55">{piSelected ? "Withdrawable" : "Pending"}</p>
            <p className="mt-1 truncate text-[12px] font-bold tabular-nums text-white">
              {piSelected ? (piSnapshot ? maskPi(piSnapshot.withdrawable) : "—") : ghcVerified ? mask(pending) : "—"}
            </p>
          </div>
          <div className="min-w-0 border-l border-white/15 pl-3">
            <p className="text-[9px] uppercase tracking-wide text-white/55">{piSelected ? "Pending" : "Locked"}</p>
            <p className="mt-1 truncate text-[12px] font-bold tabular-nums text-white">
              {piSelected ? (piSnapshot ? maskPi(piSnapshot.pending) : "—") : ghcVerified ? mask(locked) : "—"}
            </p>
          </div>
          <div className="min-w-0 border-l border-white/15 pl-3">
            <p className="text-[9px] uppercase tracking-wide text-white/55">{piSelected ? "Reserved" : "Status"}</p>
            <p className="mt-1 truncate text-[12px] font-bold text-white">
              {piSelected ? (piSnapshot ? maskPi(piSnapshot.reserved) : "—") : (ghcVerified ? "Confirmed" : "Unverified")}
            </p>
          </div>
        </div>
      </div>

      {/* Asset switcher — each rail remains independently selectable and accounted. */}
      <div className="grid grid-cols-2 gap-2.5 p-3" role="group" aria-label="Choose wallet asset">
        <button
          type="button"
          aria-pressed={piSelected}
          onClick={() => onSelectRail?.("pi")}
          className={`relative flex min-h-[7.25rem] flex-col gap-2 rounded-[1.2rem] px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 ${
            piSelected
              ? "bg-violet-100/90 shadow-[0_14px_30px_-18px_rgba(124,58,237,0.55)] ring-1 ring-violet-400/40 dark:bg-violet-950/60"
              : "border border-border/55 bg-card/72 shadow-sm hover:bg-card"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-base font-black text-white shadow-sm" aria-hidden>
              π
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-foreground">Pi</p>
              <p className="text-[10px] text-muted-foreground">Pi earnings</p>
            </div>
          </div>
          <p className="text-[17px] font-black tabular-nums leading-none tracking-tight text-foreground">
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
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {piLoading
              ? "Checking ledger · up to 10 seconds"
              : piFailed
                ? "PI balance unavailable — refresh to retry"
                : piSnapshot?.piWalletLinked
                  ? piSnapshot.authorizationActive
                    ? piSnapshot.economyEligible
                      ? "Pi identity linked · payout authorized"
                      : "Pi identity linked · authorized · not economy-eligible"
                    : "Pi identity linked · authorize wallet to withdraw"
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
          aria-pressed={!piSelected}
          onClick={() => onSelectRail?.("ghc")}
          className={`relative flex min-h-[7.25rem] flex-col gap-2 rounded-[1.2rem] px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
            !piSelected
              ? "bg-emerald-100/90 shadow-[0_14px_30px_-18px_rgba(5,150,105,0.55)] ring-1 ring-emerald-400/40 dark:bg-emerald-950/60"
              : "border border-border/55 bg-card/72 shadow-sm hover:bg-card"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 shadow-sm" aria-hidden>
              <GhcCoinIcon size={18} className="text-white" title="" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-foreground">GHC</p>
              <p className="text-[10px] text-muted-foreground">GreenHaven Credits</p>
            </div>
          </div>
          <p className="text-[17px] font-black tabular-nums leading-none tracking-tight text-foreground">
            {ghcVerified ? (balanceVisible ? formatGhc(balance) : "••••") : "Unavailable"}
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {!ghcVerified
              ? "Server confirmation required"
              : pending > 0 || locked > 0
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
        GHC and Pi remain separate rails. PI and GHC are never added together. GHC utility and PI earnings remain separate assets and separate ledgers.
        {" "}{ASSET_POLICY.ghcRailsCopy} {ASSET_POLICY.piRailsCopy}
      </p>
    </section>
  )
}
