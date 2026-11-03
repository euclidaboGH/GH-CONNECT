"use client"

/**
 * Phase 8 — Unified PI earnings & payout dashboard.
 * Server-authoritative: /api/economy/earnings/withdrawable + /api/economy/earnings
 * Never invents balances. Explains ineligible / review / fee states clearly.
 */

import { confirmDialog } from "@/lib/ui/global-interactions"
import { useCallback, useEffect, useRef, useState } from "react"
import { RegistrationBonusCard } from "./registration-bonus-card"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Link2,
  Percent,
  RefreshCw,
  Shield,
  Wallet,
} from "lucide-react"

type Withdrawable = {
  ok?: boolean
  availableAtomic?: number | string
  reservedAtomic?: number | string
  pendingAtomic?: number | string
  paidAtomic?: number | string
  withdrawableAtomic?: number | string
  available?: number
  reserved?: number
  pending?: number
  paid?: number
  withdrawable?: number
  minPayout?: number
  maxSinglePayout?: number
  feeBps?: number
  feePercent?: number
  eligible?: boolean
  reasons?: string[]
  piWalletLinked?: boolean
  linkedPiUsername?: string | null
  linkedPiAppUid?: string | null
  walletAuthorization?: {
    authorizationActive?: boolean
    hasMapping?: boolean
    error?: string
  } | null
  error?: string
}

type LedgerEntry = {
  id?: string
  entry_type?: string
  source_kind?: string
  amount_atomic?: string | number
  status?: string
  unique_ref?: string
  payout_request_id?: string
  reason?: string
  created_at?: string
}

type Statement = {
  ok?: boolean
  balances?: Withdrawable
  entries?: LedgerEntry[]
  error?: string
}

function atomicToDisplay(value: unknown): string {
  // Ledger amount_atomic is always atomic units, regardless of JSON number/string encoding.
  try {
    const raw = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : String(value ?? "")
    if (/^\d{1,38}$/.test(raw)) {
      const atomic = BigInt(raw)
      const whole = atomic / BigInt(10000000)
      const frac = (atomic % BigInt(10000000)).toString().padStart(7, "0").replace(/0+$/, "") || "0"
      return `${whole.toLocaleString()}.${frac} π`
    }
  } catch {
    /* Invalid ledger data remains unavailable rather than becoming a fabricated zero. */
  }
  return "Unavailable"
}

function piToDisplay(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "Unavailable"
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} π`
}

function reasonLabel(code: string): string {
  switch (code) {
    case "BELOW_MIN_PAYOUT":
      return "Balance is below the minimum payout threshold."
    case "NO_AVAILABLE_BALANCE":
      return "No available earnings to withdraw yet."
    case "LINKED_PI_IDENTITY_REQUIRED":
      return "Sign in with Pi so your wallet is linked to this account."
    case "WALLET_AUTHORIZATION_REQUIRED":
      return "Authorize Pi wallet payouts once — then you can withdraw to your linked Pi wallet."
    case "WALLET_AUTHORIZATION_UNAVAILABLE":
      return "Payout authorization service is temporarily unavailable. Try again shortly."
    case "IDENTITY_MAPPING_REQUIRED":
      return "Sign in with Pi so GreenHaven can verify your identity before authorizing payouts."
    case "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED":
      return "PI withdrawals are not enabled on this deployment yet (operator Testnet gate)."
    case "INSUFFICIENT_WITHDRAWABLE_BALANCE":
    case "INSUFFICIENT_BALANCE":
      return "Your available earnings are insufficient for this withdrawal."
    case "PAYOUT_PENDING":
    case "PAYOUT_ALREADY_PENDING":
      return "Your withdrawal is being processed. Check transaction history for updates."
    case "PAYOUT_FAILED":
      return "The withdrawal could not be completed. No duplicate charge was applied; you can try again later."
    case "DUPLICATE_IDEMPOTENCY_KEY":
      return "This withdrawal request was already submitted. Check history instead of retrying with the same request."
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a moment and try again."
    case "AUTH_REQUIRED":
      return "Sign in again to continue with withdrawals."
    default:
      return code.replace(/_/g, " ").toLowerCase()
  }
}

function humanizeApiError(code?: string | null, message?: string | null): string {
  if (message && message.trim() && !/^[A-Z][A-Z0-9_]{3,}$/.test(message.trim())) return message.trim()
  if (code) return reasonLabel(code)
  return "Something went wrong. No transfer was started."
}

function statusTone(status?: string): string {
  switch (status) {
    case "available":
      return "text-emerald-700 bg-emerald-50"
    case "pending":
      return "text-amber-800 bg-amber-50"
    case "reserved":
      return "text-sky-800 bg-sky-50"
    case "paid":
      return "text-slate-700 bg-slate-100"
    case "reversed":
    case "disputed":
      return "text-rose-700 bg-rose-50"
    default:
      return "text-slate-600 bg-slate-50"
  }
}

export function UnifiedEarningsDashboard({ compact = false }: { compact?: boolean }) {
  const [snap, setSnap] = useState<Withdrawable | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [quoteMsg, setQuoteMsg] = useState<string | null>(null)
  const [quoteDetail, setQuoteDetail] = useState<{
    gross: number
    fee: number
    net: number
    recipientUsername?: string
  } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [requestingPayout, setRequestingPayout] = useState(false)
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null)
  const [walletAuthActive, setWalletAuthActive] = useState<boolean | null>(null)
  const [walletAuthLoading, setWalletAuthLoading] = useState(false)
  const [authorizingWallet, setAuthorizingWallet] = useState(false)
  const [charityTotal, setCharityTotal] = useState<string | null>(null)
  const [charityCount, setCharityCount] = useState(0)
  const [crossFindings, setCrossFindings] = useState<string[]>([])
  const [crossStatus, setCrossStatus] = useState<"healthy" | "attention" | "degraded" | null>(null)
  const quoteController = useRef<AbortController | null>(null)
  const quoteSequence = useRef(0)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const [wRes, sRes, cRes, xRes] = await Promise.all([
        fetch("/api/economy/earnings/withdrawable", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        }),
        fetch("/api/economy/earnings?limit=20", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        }),
        fetch("/api/economy/earnings/charity", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        }),
        fetch("/api/economy/wallet/cross-reconcile", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        }),
      ])
      const wJson = (await wRes.json().catch(() => null)) as Withdrawable | null
      const sJson = (await sRes.json().catch(() => null)) as Statement | null
      const cJson = (await cRes.json().catch(() => null)) as {
        ok?: boolean
        total?: number
        totalAtomic?: string | number
        contributionCount?: number
      } | null
      if (cRes.ok && cJson?.ok) {
        setCharityCount(Number(cJson.contributionCount) || 0)
        setCharityTotal(
          typeof cJson.total === "number"
            ? `${cJson.total} π`
            : cJson.totalAtomic != null
              ? String(cJson.totalAtomic)
              : "0 π",
        )
      } else {
        setCharityCount(0)
        setCharityTotal(null)
      }
      const xJson = (await xRes.json().catch(() => null)) as {
        ok?: boolean
        report?: { status?: "healthy" | "attention" | "degraded"; findings?: Array<{ code?: string; severity?: string; message?: string }> }
      } | null
      if (xRes.ok && xJson?.ok && Array.isArray(xJson.report?.findings)) {
        setCrossStatus(xJson.report.status || "attention")
        setCrossFindings(
          xJson.report!.findings!
            .filter((f) => f.severity === "attention")
            .map((f) => f.message || f.code || "")
            .filter(Boolean)
            .slice(0, 3),
        )
      } else {
        setCrossStatus("degraded")
        setCrossFindings(["Cross-feature reconciliation is currently unavailable. Financial snapshots remain independently sourced."])
      }

      if (!wRes.ok || !wJson?.ok) {
        setFailed(true)
        setSnap(null)
      } else {
        setFailed(false)
        setSnap(wJson)
        const wa = wJson.walletAuthorization
        if (wa) {
          const activeFlag =
            typeof wa.authorizationActive === "boolean"
              ? wa.authorizationActive
              : typeof (wa as { active?: unknown }).active === "boolean"
                ? Boolean((wa as { active: boolean }).active)
                : null
          if (typeof activeFlag === "boolean") setWalletAuthActive(activeFlag)
        }
      }
      if (sRes.ok && sJson?.ok && Array.isArray(sJson.entries)) {
        setEntries(sJson.entries)
      } else {
        setEntries([])
      }

      // Explicit A2U payout consent status (separate from Pi identity link)
      try {
        setWalletAuthLoading(true)
        const aRes = await fetch("/api/identity/wallet-authorization", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        })
        const aJson = (await aRes.json().catch(() => null)) as {
          ok?: boolean
          authorizationActive?: boolean
          error?: string
        } | null
        if (!signal?.aborted) {
          if (aRes.ok && aJson?.ok) {
            setWalletAuthActive(aJson.authorizationActive === true)
          } else if (aJson?.error === "WALLET_AUTHORIZATION_UNAVAILABLE") {
            setWalletAuthActive(null)
          } else {
            setWalletAuthActive(false)
          }
        }
      } catch {
        if (!signal?.aborted) setWalletAuthActive(null)
      } finally {
        if (!signal?.aborted) setWalletAuthLoading(false)
      }
    } catch {
      if (!signal?.aborted) {
        setFailed(true)
        setSnap(null)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    // Phase 1: never leave "Loading PI earnings…" stuck — hard timeout + fail closed
    const hardTimeout = window.setTimeout(() => {
      try {
        ac.abort()
      } catch { /* */ }
      setLoading(false)
      setFailed(true)
    }, 12_000)
    void refresh(ac.signal).finally(() => {
      window.clearTimeout(hardTimeout)
    })
    const onRefresh = () => {
      const next = new AbortController()
      const t = window.setTimeout(() => {
        try {
          next.abort()
        } catch { /* */ }
        setLoading(false)
        setFailed(true)
      }, 12_000)
      void refresh(next.signal).finally(() => window.clearTimeout(t))
    }
    window.addEventListener("ghc:wallet-refresh", onRefresh)
    window.addEventListener("ghc:earnings-refresh", onRefresh)
    window.addEventListener("ghc:wallet-auth-changed", onRefresh)
    return () => {
      window.clearTimeout(hardTimeout)
      ac.abort()
      window.removeEventListener("ghc:wallet-refresh", onRefresh)
      window.removeEventListener("ghc:earnings-refresh", onRefresh)
      window.removeEventListener("ghc:wallet-auth-changed", onRefresh)
    }
  }, [refresh])

  useEffect(() => () => {
    quoteController.current?.abort()
    quoteSequence.current += 1
  }, [])



  const onAuthorizeWallet = async (): Promise<boolean> => {
    if (authorizingWallet) return false
    setAuthorizingWallet(true)
    setPayoutMsg(null)
    try {
      const res = await fetch("/api/identity/wallet-authorization", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        message?: string
        status?: string
      } | null
      if (!res.ok || !body?.ok) {
        setPayoutMsg(humanizeApiError(body?.error, body?.message))
        if (body?.error === "IDENTITY_MAPPING_REQUIRED") setWalletAuthActive(false)
        return false
      }
      setPayoutMsg(body.message || "Authorization recorded. Confirming…")
      try {
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh", { detail: { reason: "wallet-auth-granted" } }))
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: { message: "Pi payouts authorized for your linked wallet", type: "success" },
          }),
        )
        window.dispatchEvent(new CustomEvent("ghc:wallet-auth-changed", { detail: { active: true } }))
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
      } catch { /* */ }
      await refresh()
      // Prefer server-confirmed active flag from refresh; fall back to POST ok + active status.
      const confirmed =
        body.status === "active" || body.ok === true
      if (confirmed) {
        setWalletAuthActive(true)
        setPayoutMsg("Pi wallet authorized. Tap Withdraw again to quote and request payout.")
        return true
      }
      setPayoutMsg("Authorization submitted. Tap Withdraw when the server confirms eligibility.")
      return false
    } catch {
      setPayoutMsg("Network error while authorizing Pi payouts. No transfer was started.")
      return false
    } finally {
      setAuthorizingWallet(false)
    }
  }


  const onRevokeWalletAuth = async () => {
    if (authorizingWallet) return
    const ok = await confirmDialog({
      title: "Revoke Pi payout authorization?",
      message: "Future withdrawals will be blocked until you authorize again. Already submitted payouts are not reversed.",
      confirmLabel: "Revoke",
      cancelLabel: "Keep authorized",
      danger: true,
    })
    if (!ok) return
    setAuthorizingWallet(true)
    setPayoutMsg(null)
    try {
      const res = await fetch("/api/identity/wallet-authorization", {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "user_revoked" }),
        cache: "no-store",
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string; revoked?: boolean } | null
      if (!res.ok || !body?.ok) {
        setPayoutMsg(humanizeApiError(body?.error, body?.message))
        return
      }
      setWalletAuthActive(false)
      setPayoutMsg("Pi payout authorization revoked. Withdrawals are blocked until you authorize again.")
      void refresh()
    } catch {
      setPayoutMsg("Network error while revoking authorization.")
    } finally {
      setAuthorizingWallet(false)
    }
  }

  const onRequestPayout = async () => {
    if (requestingPayout) return
    if (snap?.eligible !== true || snap.piWalletLinked !== true) {
      setPayoutMsg("Withdrawal is not available until the server confirms eligibility and a linked Pi identity.")
      return
    }
    if (typeof snap.withdrawable !== "number" || !Number.isFinite(snap.withdrawable) || snap.withdrawable <= 0) {
      setPayoutMsg("No withdrawable PI balance to request.")
      return
    }
    // Convert PI decimal to atomic using server scale 1e7 (floor)
    const amountAtomic = Math.floor(snap.withdrawable * 10_000_000 + 1e-12)
    if (!Number.isSafeInteger(amountAtomic) || amountAtomic <= 0) {
      setPayoutMsg("Amount could not be converted to valid atomic units.")
      return
    }
    setRequestingPayout(true)
    setPayoutMsg(null)
    try {
      const idempotencyKey = `ui-payout:${Date.now()}:${amountAtomic}`
      const res = await fetch("/api/economy/earnings/withdrawals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amountAtomic, idempotencyKey }),
        cache: "no-store",
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        message?: string
        requestId?: string
        status?: string
      } | null
      if (res.status === 503 || body?.error === "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED") {
        setPayoutMsg(
          "Withdrawals are not open on this deployment yet. No transfer was started.",
        )
        return
      }
      if (!res.ok || !body?.ok) {
        const code = body?.error || ""
        if (code === "WALLET_AUTHORIZATION_REQUIRED") {
          setWalletAuthActive(false)
          setPayoutMsg("Authorize Pi wallet payouts once — then you can withdraw to your linked Pi wallet.")
          return
        }
        setPayoutMsg(humanizeApiError(body?.error, body?.message) || "Could not create a payout request. No transfer was started.")
        return
      }
      setPayoutMsg(
        body.message ||
          `Payout request recorded (${body.requestId || "queued"}). This does not send Pi until the server execution worker completes a verified A2U transfer.`,
      )
      try {
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh", { detail: { reason: "payout-request" } }))
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "payout-request" } }))
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: {
              message: body.message || `Payout request ${body.requestId || "queued"} recorded`,
              type: "success",
            },
          }),
        )
      } catch { /* */ }
    } catch {
      setPayoutMsg("Network error while creating payout request. No transfer was started.")
    } finally {
      setRequestingPayout(false)
    }
  }

  const onPreviewFee = async () => {
    if (snap?.eligible !== true || snap.piWalletLinked !== true) {
      setQuoteMsg("A quote is unavailable until the server confirms payout eligibility and a linked Pi identity.")
      return
    }
    if (typeof snap.withdrawable !== "number" || !Number.isFinite(snap.withdrawable) || snap.withdrawable <= 0) {
      setQuoteMsg("No valid withdrawable balance is available to quote.")
      return
    }
    quoteController.current?.abort()
    const controller = new AbortController()
    quoteController.current = controller
    const sequence = ++quoteSequence.current
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    setQuoting(true)
    setQuoteMsg(null)
    setQuoteDetail(null)
    try {
      const res = await fetch("/api/economy/earnings/quote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amountPi: snap.withdrawable }),
        cache: "no-store",
        signal: controller.signal,
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        message?: string
        gross?: number
        fee?: number
        net?: number
        recipientUsername?: string
      } | null
      if (sequence !== quoteSequence.current) return
      if (!res.ok || !body?.ok) {
        setQuoteMsg(body?.message || body?.error || "Could not quote withdrawal.")
        return
      }
      if (typeof body.gross === "number" && typeof body.fee === "number" && typeof body.net === "number") {
        setQuoteDetail({
          gross: body.gross,
          fee: body.fee,
          net: body.net,
          recipientUsername: body.recipientUsername || undefined,
        })
      }
      setQuoteMsg(
        `Gross ${body.gross} π → fee ${body.fee} π (3%) → net ${body.net} π` +
          (body.recipientUsername ? ` to @${body.recipientUsername}` : " to your linked Pi wallet"),
      )
    } catch {
      if (sequence === quoteSequence.current) setQuoteMsg(controller.signal.aborted ? "Quote timed out or was cancelled. Please retry." : "Quote unavailable. Try again.")
    } finally {
      window.clearTimeout(timeout)
      if (sequence === quoteSequence.current) setQuoting(false)
      if (quoteController.current === controller) quoteController.current = null
    }
  }

  if (loading && !snap) {
    return (
      <section className="mx-3 mt-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm" aria-busy>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-3 h-10 w-56 animate-pulse rounded bg-slate-100" />
        <p className="mt-2 text-xs text-slate-500">Loading PI earnings…</p>
      </section>
    )
  }

  if (failed || !snap) {
    return (
      <section className="mx-3 mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-950">PI earnings unavailable</p>
            <p className="mt-1 text-xs text-amber-900/80">
              Could not load the server earnings ledger. No balances were invented.
            </p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 shadow-sm"
              onClick={() => {
                setFailed(false)
                setLoading(true)
                const ac = new AbortController()
                const t = window.setTimeout(() => {
                  try {
                    ac.abort()
                  } catch { /* */ }
                  setLoading(false)
                  setFailed(true)
                }, 12_000)
                void refresh(ac.signal).finally(() => window.clearTimeout(t))
              }}
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      </section>
    )
  }

  const feePct = snap.feePercent ?? (snap.feeBps != null ? snap.feeBps / 100 : 3)
  const available = typeof snap.available === "number" ? snap.available : atomicToDisplay(snap.availableAtomic)
  const pending = typeof snap.pending === "number" ? snap.pending : atomicToDisplay(snap.pendingAtomic)
  const withdrawable = typeof snap.withdrawable === "number" ? snap.withdrawable : atomicToDisplay(snap.withdrawableAtomic)

  const runWithdraw = async () => {
    // Phase 4: single primary control — authorize when needed, then quote, then request.
    if (walletAuthActive !== true) {
      const granted = await onAuthorizeWallet()
      if (!granted) return
      // Continue in the same gesture once server confirms authorization.
    }
    if (!quoteDetail) {
      await onPreviewFee()
    }
    await onRequestPayout()
  }

  return (
    <section
      id="gh-pi-earnings-tools"
      className={
        compact
          ? "overflow-hidden rounded-2xl border border-border/60 bg-card"
          : "mx-3 mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      }
      aria-label="Pi balance"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
            π
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Pi</p>
            <p className="text-[11px] text-muted-foreground">
              {snap.linkedPiUsername ? `@${snap.linkedPiUsername}` : snap.piWalletLinked ? "Linked" : "Not linked"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Refresh Pi balance"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4">
        {[
          { label: "Available", value: available },
          { label: "Pending", value: pending },
          { label: "Reserved", value: typeof snap.reserved === "number" ? snap.reserved : atomicToDisplay(snap.reservedAtomic) },
          { label: "Paid", value: typeof snap.paid === "number" ? snap.paid : atomicToDisplay(snap.paidAtomic) },
        ].map((cell) => (
          <div key={cell.label} className="rounded-xl bg-muted/40 px-2.5 py-2 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{cell.label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
              {typeof cell.value === "number" ? piToDisplay(cell.value) : String(cell.value)}
            </p>
          </div>
        ))}
      </div>
      <p className="px-4 pb-1 text-center text-[11px] text-muted-foreground">
        Withdrawable <span className="font-semibold text-foreground">{typeof withdrawable === "number" ? piToDisplay(withdrawable) : String(withdrawable)}</span>
        {" · "}{feePct}% fee · linked at sign-in{snap.linkedPiUsername ? ` (@${snap.linkedPiUsername})` : ""}
      </p>
      {(charityTotal || charityCount > 0) ? (
        <p className="px-4 pb-2 text-center text-[10px] text-muted-foreground" role="status">
          Charity recorded: {charityTotal || "—"}
          {charityCount > 0 ? ` · ${charityCount} contribution${charityCount === 1 ? "" : "s"}` : ""}
          {" · "}segregated charity, separate from withdrawable balance
        </p>
      ) : (
        <p className="sr-only">
          Platform charity accounting is segregated charity, separate from withdrawable balance.
        </p>
      )}
      {crossStatus === "healthy" ? (
        <p className="sr-only">Financial snapshots reconciled. Cross-feature attention is clear.</p>
      ) : crossStatus === "attention" && crossFindings.length > 0 ? (
        <div className="mx-4 mb-2 rounded-xl border border-amber-300/60 bg-amber-50/80 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40" role="status">
          <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">Cross-feature attention</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-amber-900/90 dark:text-amber-100/90">
            {crossFindings.slice(0, 3).map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : crossStatus === "degraded" ? (
        <p className="mx-4 mb-2 text-center text-[10px] font-medium text-rose-700 dark:text-rose-300" role="status">
          Reconciliation unavailable
        </p>
      ) : (
        <p className="sr-only">Cross-feature attention awaits the next wallet cross-reconcile report.</p>
      )}


      {quoteDetail ? (
        <div className="mx-4 mb-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {quoteDetail.gross} π − {feePct}% fee ({quoteDetail.fee} π) → <span className="font-semibold text-foreground">{quoteDetail.net} π</span>
            {quoteDetail.recipientUsername ? ` → @${quoteDetail.recipientUsername}` : ""}
          </p>
        </div>
      ) : null}

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => void runWithdraw()}
          disabled={
            requestingPayout ||
            authorizingWallet ||
            walletAuthLoading ||
            snap.eligible !== true ||
            snap.piWalletLinked !== true ||
            !(typeof snap.withdrawable === "number" && Number.isFinite(snap.withdrawable) && snap.withdrawable > 0)
          }
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-violet-700 px-4 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50"
        >
          {authorizingWallet
            ? "Authorizing…"
            : requestingPayout
              ? "Submitting…"
              : walletAuthActive !== true
                ? "Authorize Pi wallet"
                : !quoteDetail
                  ? "Review fee & withdraw"
                  : "Withdraw to Pi"}
        </button>
        {payoutMsg ? (
          <p className="mt-2 text-center text-[12px] font-medium text-amber-800 dark:text-amber-200" role="status">
            {humanizeApiError(
              /^[A-Z][A-Z0-9_]{3,}$/.test(payoutMsg.trim()) ? payoutMsg.trim() : undefined,
              payoutMsg,
            )}
          </p>
        ) : null}
        {walletAuthActive === true && snap.linkedPiUsername ? (
          <button
            type="button"
            disabled={authorizingWallet}
            onClick={() => void onRevokeWalletAuth()}
            className="mt-2 w-full text-center text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            Revoke payout authorization
          </button>
        ) : null}
      </div>

      {entries.length > 0 ? (
        <div className="border-t border-border/40 px-4 py-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Recent ledger</p>
          <ul className="space-y-2">
            {entries.slice(0, compact ? 3 : 6).map((e, idx) => (
              <li key={String(e.id || e.unique_ref || idx)} className="flex items-start justify-between gap-2 text-[12px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{e.entry_type || e.source_kind || "entry"}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{e.unique_ref || e.reason || ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-foreground">
                    {e.amount_atomic != null ? atomicToDisplay(e.amount_atomic) : "—"}
                  </p>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusTone(e.status)}`}>{e.status || "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
