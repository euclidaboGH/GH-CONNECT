"use client"

/**
 * Dual-asset wallet hero — PI earnings and GHC utility in one professional card.
 * Rails stay separate; shared Send / Request / Receive / History actions sit below.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Eye, EyeOff, RefreshCw } from "lucide-react"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { formatGhc } from "./wallet-format"
import { formatPiAmount } from "@/lib/wallet/pi-amount"
import { releaseReservedPi, emitWalletBalanceRefresh, humanizeReleaseReservedError } from "@/lib/wallet/release-reserved-pi"

export type WalletAssetRail = "pi" | "ghc"

export function WalletBalanceCard({
  balance,
  balanceVisible,
  onToggleVisible,
  refreshing,
  lastSynced,
  pending,
  locked,
  escrowLocked = 0,
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
  escrowLocked?: number
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
    authorizationActive: boolean
    piWalletLinked: boolean
    reasons: string[]
  } | null>(null)
  const [piLoading, setPiLoading] = useState(true)
  const [piFailed, setPiFailed] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [showReserved, setShowReserved] = useState(false)
  const [releaseMsg, setReleaseMsg] = useState<string | null>(null)
  const [releaseItems, setReleaseItems] = useState<Array<{
    requestId: string
    status: string
    grossAtomic: number | string
    reason: string
    unlockCondition: string
  }>>([])
  const [reconcilingRequestId, setReconcilingRequestId] = useState<string | null>(null)
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null)
  const lastPiFetchRef = useRef(0)
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
          // Fail closed: never show an unconfirmed balance.
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
          // Server economy eligibility (ledger/policy). Payout readiness also needs authorizationActive.
          eligible: data.eligible === true,
          authorizationActive: authActive === true,
          piWalletLinked: data.piWalletLinked === true,
          reasons: Array.isArray(data.reasons) ? data.reasons.map(String) : [],
        })
        setPiFailed(false)
        lastPiFetchRef.current = Date.now()
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
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastPiFetchRef.current > 30_000) void refreshPi()
    }
    document.addEventListener("visibilitychange", onVisible)
    const onOnline = () => {
      setWalletOnline(true)
      void refreshPi()
    }
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
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [refreshPi])

  const releaseReserved = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setReleaseMsg("You are offline. Reserved π is unchanged; reconnect to return incomplete reservations.")
      return
    }
    setReleasing(true)
    setReleaseMsg(null)
    setReconcileMsg(null)
    try {
      const result = await releaseReservedPi()
      if (result.ok) {
        setReleaseMsg(
          result.released
            ? `${result.released} incomplete withdrawal${result.released === 1 ? "" : "s"} returned to Available. ${result.message || ""}`.trim()
            : result.message || "No incomplete reservation could be released yet. Details below — reserved π was not force-cleared."
        )
        setReleaseItems(
          Array.isArray(result.items)
            ? result.items
                .filter((item) => typeof item.requestId === "string")
                .map((item) => ({
                  requestId: String(item.requestId),
                  status: String(item.status || "unknown"),
                  grossAtomic: item.grossAtomic ?? "—",
                  reason: String(item.reason || "See unlock condition."),
                  unlockCondition: String(item.unlockCondition || "Server will unlock when safe."),
                }))
            : []
        )
        emitWalletBalanceRefresh()
        void refreshPi()
      } else {
        setReleaseMsg(result.message || humanizeReleaseReservedError(result.error))
        if (result.items?.length) {
          setReleaseItems(
            result.items
              .filter((item) => typeof item.requestId === "string")
              .map((item) => ({
                requestId: String(item.requestId),
                status: String(item.status || "unknown"),
                grossAtomic: item.grossAtomic ?? "—",
                reason: String(item.reason || "See unlock condition."),
                unlockCondition: String(item.unlockCondition || "Server will unlock when safe."),
              }))
          )
        } else {
          setReleaseItems([])
        }
      }
    } catch {
      setReleaseMsg("Network error while checking reserved π. Nothing was changed on the server.")
      setReleaseItems([])
    } finally {
      setReleasing(false)
    }
  }, [refreshPi])

  const reconcilePiRequest = useCallback(async (requestId: string) => {
    if (!requestId || reconcilingRequestId) return
    setReconcilingRequestId(requestId)
    setReconcileMsg(null)
    try {
      const res = await fetch("/api/economy/earnings/withdrawals/process", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
        signal: AbortSignal.timeout(90_000),
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        status?: string
        error?: string
        diagnosticCode?: string
      } | null
      if (body?.ok && body.status === "paid") {
        setReleaseItems((items) => items.filter((item) => item.requestId !== requestId))
        setReconcileMsg(`Pi confirmed and settled withdrawal ${requestId.slice(0, 8)}. Your wallet is refreshing.`)
      } else if (body?.error === "PI_UNCERTAIN_REQUEST_REQUIRES_OPERATOR_RECONCILIATION") {
        setReconcileMsg(`Pi returned no exact incomplete payment for ${requestId.slice(0, 8)}. No replacement transfer was created and the reservation remains protected; operator reconciliation is required.`)
      } else if (body?.error === "UNRELATED_INCOMPLETE_A2U_REQUIRES_OPERATOR_REVIEW") {
        setReconcileMsg("A different incomplete Pi App-to-User payment is blocking this request. It has been flagged for operator review; no payment was cancelled or duplicated.")
      } else if (body?.error === "PI_EARNINGS_EXECUTION_UNCERTAIN") {
        setReconcileMsg(`Pi could not confirm the provider outcome. Your reservation remains protected. Reference: ${body.diagnosticCode || "PI_PROVIDER_UNCERTAIN"}`)
      } else if (body?.error === "PI_PAYOUT_WALLET_ADDRESS_MISMATCH" || body?.error === "PI_PROVIDER_WALLET_ADDRESS_UNAVAILABLE") {
        setReconcileMsg("Pi's actual payment destination could not be confirmed against your connected wallet. The payout was not submitted and has been flagged for operator review.")
      } else if (body?.error === "PI_WALLET_ADDRESS_CHANGED_SINCE_REQUEST") {
        setReconcileMsg("Your connected Pi wallet changed after this request was reserved. The request remains protected and must be reconciled before a new withdrawal can be created.")
      } else if (body?.error === "WALLET_AUTHORIZATION_REQUIRED" || body?.error === "PI_WALLET_ADDRESS_VERIFICATION_REQUIRED" || body?.error === "PI_WALLET_ADDRESS_REVERIFICATION_REQUIRED") {
        setReconcileMsg("Reconnect Pi in the Withdraw sheet and approve the wallet-address permission before checking this payout.")
      } else {
        setReconcileMsg("The existing payout could not be reconciled. No reservation was released and no replacement payment was created.")
      }
      void refreshPi()
      window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
    } catch {
      setReconcileMsg("Could not reach Pi's payout status check. Your reservation remains unchanged; try again when the connection is stable.")
    } finally {
      setReconcilingRequestId(null)
    }
  }, [reconcilingRequestId, refreshPi])

  const mask = (n: number) => (balanceVisible ? formatGhc(n) : "••••")
  const maskPi = (n: number) =>
    balanceVisible
      ? `${formatPiAmount(n)} π`
      : "••••"
  const synced =
    lastSynced && Number.isFinite(lastSynced)
      ? new Date(lastSynced).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : null

  const piSelected = selectedRail === "pi"
  const ghcSelected = selectedRail === "ghc"
  const online = walletOnline
  const statusLabel = !online ? "Offline" : refreshing || (piSelected && piLoading) ? "Syncing" : (piSelected ? piSnapshot !== null : ghcVerified) ? "Live" : "Unconfirmed"
  const statusTone = !online || statusLabel === "Unconfirmed" ? "bg-amber-400" : statusLabel === "Syncing" ? "bg-sky-400 animate-pulse" : "bg-emerald-400"
  const glow = piSelected
    ? "bg-[radial-gradient(circle_at_85%_0%,rgba(139,92,246,0.45),transparent_55%),radial-gradient(circle_at_0%_100%,rgba(56,189,248,0.18),transparent_50%)]"
    : "bg-[radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.42),transparent_55%),radial-gradient(circle_at_0%_100%,rgba(250,204,21,0.14),transparent_50%)]"
  const reservedAmount = piSnapshot?.reserved ?? 0

  const stats = piSelected
    ? [
        { label: "Withdrawable", full: "Eligible to withdraw", value: piSnapshot ? maskPi(piSnapshot.withdrawable) : "—" },
        { label: "Pending", full: "Pending", value: piSnapshot ? maskPi(piSnapshot.pending) : "—" },
        { label: "Reserved", full: "Reserved for requests", value: piSnapshot ? maskPi(piSnapshot.reserved) : "—" },
      ]
    : [
        { label: "Pending", full: "Pending", value: ghcVerified ? mask(pending) : "—" },
        { label: "Locked", full: "Locked", value: ghcVerified ? mask(locked) : "—" },
        { label: "Escrow", full: "Escrow locked", value: ghcVerified ? mask(escrowLocked) : "—" },
      ]

  return (
    <section
      className="relative mx-3 mt-3 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#060b16] text-white shadow-[0_26px_60px_-26px_rgba(2,6,23,0.85)]"
      aria-label="Unified PI and GHC wallet balances; Pi and GHC remain separate"
    >
      {/* Ambient light + fine technical grid */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${glow}`} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)",
          backgroundSize: "24px 24px",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 85%)",
          maskImage: "linear-gradient(to bottom, black, transparent 85%)",
        }}
        aria-hidden
      />

      <div className="relative p-4 pb-3">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2" role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${statusTone}`} aria-hidden />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/70">{statusLabel}</span>
            {synced ? <span className="truncate text-[10px] tabular-nums text-white/40">· {synced}</span> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {piSelected ? (
              <button
                type="button"
                onClick={() => void refreshPi()}
                disabled={piLoading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/15 active:scale-95 disabled:opacity-60"
                aria-label="Refresh PI balance"
                aria-busy={piLoading}
              >
                <RefreshCw size={15} className={piLoading ? "animate-spin" : ""} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleVisible}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/15 active:scale-95"
              aria-label={balanceVisible ? "Hide balances" : "Show balances"}
              aria-pressed={!balanceVisible}
            >
              {balanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Rail switcher — a segmented control, not duplicate cards */}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/30 p-1 backdrop-blur" role="group" aria-label="Choose wallet asset">
          <button
            type="button"
            aria-pressed={piSelected}
            onClick={() => onSelectRail?.("pi")}
            className={`flex h-10 items-center justify-center gap-2 rounded-full text-[12px] font-extrabold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b16] ${
              piSelected ? "bg-violet-600 text-white shadow-lg shadow-violet-900/50" : "text-white/60 hover:text-white"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-black" aria-hidden>π</span>
            Pi
          </button>
          <button
            type="button"
            aria-pressed={!piSelected}
            onClick={() => onSelectRail?.("ghc")}
            className={`flex h-10 items-center justify-center gap-2 rounded-full text-[12px] font-extrabold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b16] ${
              ghcSelected ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50" : "text-white/60 hover:text-white"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20" aria-hidden>
              <GhcCoinIcon size={12} className="text-white" title="" />
            </span>
            GHC
          </button>
        </div>

        {/* Balance */}
        <div className="mt-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/50">
            {piSelected ? "Pi earnings" : "GreenHaven Credits"}
          </p>
          <p
            className="mt-1 break-words text-[clamp(2.1rem,10vw,2.9rem)] font-black leading-none tracking-tight tabular-nums"
            aria-live="polite"
            aria-label={balanceVisible ? undefined : "Balance hidden"}
          >
            {piSelected
              ? piSnapshot
                ? maskPi(piSnapshot.available)
                : piLoading
                  ? <span className="inline-block h-10 w-44 animate-pulse rounded-xl bg-white/15 align-middle" aria-label="Loading balance" />
                  : "Unavailable"
              : ghcVerified ? mask(balance) : "Unavailable"}
          </p>
          <p className="mt-1.5 text-[11px] text-white/50">
            {piSelected
              ? piLoading
                ? "Checking ledger · up to 10 seconds"
                : "Pi · separate from GHC"
              : "GHC · GreenHaven Coin"}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {piSelected && piSnapshot ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  piSnapshot.authorizationActive && piSnapshot.eligible && piSnapshot.withdrawable > 0
                    ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20"
                    : "bg-amber-300/15 text-amber-100 ring-1 ring-amber-200/20"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {!piSnapshot.piWalletLinked
                  ? "Link your Pi identity to withdraw"
                  : !piSnapshot.authorizationActive
                    ? "Authorize payouts to withdraw"
                    : piSnapshot.eligible && piSnapshot.withdrawable > 0
                      ? "Ready to withdraw"
                      : "Not eligible to withdraw yet"}
              </span>
            ) : null}
            {piSelected && piFailed ? (
              <span className="rounded-full bg-amber-300/15 px-2.5 py-1 text-[10px] font-bold text-amber-100 ring-1 ring-amber-200/20">
                Couldn’t load · tap refresh
              </span>
            ) : null}
            {!piSelected && ghcVerified ? (
              <button
                type="button"
                onClick={onOpenPending}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80 ring-1 ring-white/10 transition active:scale-95"
              >
                In {formatGhc(monthEarned)} · Out {formatGhc(monthSpent)} this month
              </button>
            ) : null}
          </div>
        </div>

        {/* Stats */}
        <dl className="mt-4 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur">
          {stats.map((row) => (
            <div key={row.label} className="min-w-0 px-3 py-2.5" title={row.full} aria-label={row.full}>
              <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">{row.label}</dt>
              <dd className="mt-0.5 truncate text-[13px] font-black tabular-nums text-white">{row.value}</dd>
            </div>
          ))}
        </dl>
        {piSelected ? (
          <p className="mt-2 text-[10px] text-white/40">withdrawable · fees and eligibility apply · 3% withdrawal fee</p>
        ) : null}

        {/* Reserved: one quiet line, details on demand */}
        {piSelected && reservedAmount > 0 ? (
          <div className="mt-3 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-3 py-2.5" role="note">
            <button
              type="button"
              onClick={() => setShowReserved((v) => !v)}
              aria-expanded={showReserved}
              className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-violet-100"
            >
              <span>{maskPi(reservedAmount)} reserved for withdrawal</span>
              <span className="text-violet-200/80 underline underline-offset-2">{showReserved ? "Hide" : "Details"}</span>
            </button>
            {showReserved ? (
              <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-violet-100/90">
                <p>
                  <strong>Reserved {maskPi(reservedAmount)}</strong> is held for incomplete withdrawal requests; it has not disappeared, but it is not spendable while those requests remain active and not spendable while a request is unresolved. The Return action is limited to requests that never started provider execution. Processing or uncertain requests stay reserved until Pi's authoritative outcome is reconciled.
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => void releaseReserved()}
                    disabled={releasing} aria-busy={releasing}
                    className="font-bold underline underline-offset-2 disabled:opacity-50"
                  >
                    {releasing ? "Returning reserved π…" : "Return reserved π to available"}
                  </button>
                  {releaseMsg ? <span role="status">{releaseMsg}</span> : null}
                </div>
                {releaseItems.length > 0 ? (
                  <ul className="space-y-2" aria-label="Pi reservation explanations">
                    {releaseItems.map((item) => (
                      <li key={item.requestId} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <p className="font-semibold">{item.status.replaceAll("_", " ").toUpperCase()} · {item.requestId.slice(0, 8)}</p>
                        <p className="mt-0.5">{item.reason}</p>
                        <p className="mt-1"><strong>When it unlocks:</strong> {item.unlockCondition}</p>
                        {item.status.toLowerCase() === "uncertain" ? (
                          <button
                            type="button"
                            onClick={() => void reconcilePiRequest(item.requestId)}
                            disabled={Boolean(reconcilingRequestId)}
                            className="mt-2 rounded-full border border-violet-200/30 bg-violet-200/10 px-3 py-1.5 text-[10px] font-bold text-violet-100 disabled:opacity-50"
                          >
                            {reconcilingRequestId === item.requestId ? "Checking exact Pi payment…" : "Reconcile this Pi payout"}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {reconcileMsg ? <p className="rounded-lg border border-white/10 bg-black/20 p-2 text-[10px] leading-relaxed text-violet-100" role="status">{reconcileMsg}</p> : null}
                <p className="text-[10px] leading-relaxed text-violet-100/60">
                  Safety rule: this action can release only a never-started request with no Pi payment ID, transaction ID, provider receipt/verification, execution start, lease token/expiry or provider attempt. A processing/uncertain request may have reached Pi before its payment ID was saved, so a missing ID alone is not proof that no payment exists. Those funds remain reserved until authoritative provider reconciliation. A timeout alone never releases or forfeits your earned balance.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Actions live INSIDE the card so they never feel detached */}
      {primaryActions ? <div className="relative border-t border-white/10 bg-black/25 px-3 py-3">{primaryActions}</div> : null}

      <p className="sr-only">
        GHC and Pi remain separate rails. PI and GHC are never added together. GHC utility and PI earnings remain separate assets and separate ledgers.
        {" "}{ASSET_POLICY.ghcRailsCopy} {ASSET_POLICY.piRailsCopy}
      </p>
    </section>
  )
}
