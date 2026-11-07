"use client"

/**
 * Phase 8 — Unified PI earnings & payout dashboard.
 * Server-authoritative: /api/economy/earnings/withdrawable + /api/economy/earnings
 * Never invents balances. Explains ineligible / review / fee states clearly.
 */

import { confirmDialog } from "@/lib/ui/global-interactions"
import { useCallback, useEffect, useRef, useState } from "react"
import { apiRequest } from "@/lib/client/api-request"
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
    uidMatchesAuthorization?: boolean
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
  // Wallet primary actions (Withdraw / Status / Linked) focus this surface as source of truth.

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
  const payoutIdempotencyRef = useRef<{ amountAtomic: number; key: string } | null>(null)
  const quoteSequence = useRef(0)
  const refreshController = useRef<AbortController | null>(null)
  const refreshSequence = useRef(0)

  const refresh = useCallback(async (externalSignal?: AbortSignal) => {
    const sequence = ++refreshSequence.current
    refreshController.current?.abort()
    const controller = new AbortController()
    refreshController.current = controller
    const abortFromCaller = () => controller.abort()
    if (externalSignal?.aborted) controller.abort()
    else externalSignal?.addEventListener("abort", abortFromCaller, { once: true })
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    const signal = controller.signal
    setLoading(true)
    try {
      // Phase 2 complete: authenticated bounded requests (IdentityService headers + timeout).
      const [wReq, sReq, cReq, xReq] = await Promise.all([
        apiRequest<Withdrawable>("/api/economy/earnings/withdrawable", { method: "GET", signal, timeoutMs: 10_000 }),
        apiRequest<Statement>("/api/economy/earnings?limit=20", { method: "GET", signal, timeoutMs: 10_000 }),
        apiRequest<{
          ok?: boolean
          total?: number
          totalAtomic?: string | number
          contributionCount?: number
        }>("/api/economy/earnings/charity", { method: "GET", signal, timeoutMs: 10_000 }),
        apiRequest<{ ok?: boolean; status?: string; findings?: Array<{ message?: string; code?: string }> }>(
          "/api/economy/wallet/cross-reconcile",
          { method: "GET", signal, timeoutMs: 10_000 },
        ),
      ])
      if (sequence !== refreshSequence.current || signal.aborted) return
      const wJson = wReq.data
      const sJson = sReq.data
      const cJson = cReq.data
      const wRes = { ok: wReq.ok }
      const sRes = { ok: sReq.ok }
      const cRes = { ok: cReq.ok }
      const xRes = { ok: xReq.ok }
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
      const xJson = xReq.data as {
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
            wa.authorizationActive === true &&
            wa.uidMatchesAuthorization === true
          setWalletAuthActive(activeFlag)
        }
      }
      if (sRes.ok && sJson?.ok && Array.isArray(sJson.entries)) {
        setEntries(sJson.entries)
      } else {
        setEntries([])
      }

      if (sequence !== refreshSequence.current || signal.aborted) return

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
          uidMatchesAuthorization?: boolean
          error?: string
        } | null
        if (!signal?.aborted) {
          if (aRes.ok && aJson?.ok) {
            setWalletAuthActive(
              aJson.authorizationActive === true &&
              aJson.uidMatchesAuthorization === true,
            )
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
      window.clearTimeout(timeout)
      externalSignal?.removeEventListener("abort", abortFromCaller)
      if (sequence === refreshSequence.current) {
        refreshController.current = null
        setLoading(false)
        if (signal.aborted) setFailed(true)
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onRefresh = () => { void refresh() }
    window.addEventListener("ghc:wallet-refresh", onRefresh)
    window.addEventListener("ghc:earnings-refresh", onRefresh)
    window.addEventListener("ghc:wallet-auth-changed", onRefresh)
    return () => {
      refreshSequence.current += 1
      refreshController.current?.abort()
      refreshController.current = null
      window.removeEventListener("ghc:wallet-refresh", onRefresh)
      window.removeEventListener("ghc:earnings-refresh", onRefresh)
      window.removeEventListener("ghc:wallet-auth-changed", onRefresh)
    }
  }, [refresh])

  useEffect(() => () => {
    quoteController.current?.abort()
    quoteSequence.current += 1
  }, [])



  /**
   * Wallet consent is collected only in the withdrawal sheet (explicit checkbox + genuine Pi
   * authentication). The dashboard never records authorization on its own.
   */
  const openWithdrawSheet = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:open-pi-withdraw"))
    } catch { /* */ }
  }, [])

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

  const onRequestPayout = useCallback(async () => {
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
      // Keep the same request key when the client retries an uncertain network result.
      // A changed amount is a distinct intent; successful reservation clears the key.
      let pendingIntent = payoutIdempotencyRef.current
      if (!pendingIntent || pendingIntent.amountAtomic !== amountAtomic) {
        const nonce = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
        pendingIntent = { amountAtomic, key: `ui-payout:${nonce}` }
        payoutIdempotencyRef.current = pendingIntent
      }
      const idempotencyKey = pendingIntent.key
      // Phase 3: payout request via apiRequest — never claims Pi sent until worker verifies A2U.
      const wRes = await apiRequest<{
        ok?: boolean
        error?: string
        message?: string
        requestId?: string
        status?: string
      }>("/api/economy/earnings/withdrawals", {
        method: "POST",
        body: { amountAtomic, idempotencyKey },
        timeoutMs: 25_000,
      })
      const body = wRes.data
      if (wRes.status === 503 || body?.error === "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED" || wRes.code === "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED") {
        setPayoutMsg(
          "Withdrawals are not open on this deployment yet. No transfer was started.",
        )
        return
      }
      if (!wRes.ok || !body?.ok) {
        const code = body?.error || wRes.code || ""
        if (code === "WALLET_AUTHORIZATION_REQUIRED") {
          setWalletAuthActive(false)
          setPayoutMsg("Authorize Pi wallet payouts once — then you can withdraw to your linked Pi wallet.")
          return
        }
        setPayoutMsg(
          wRes.error ||
            humanizeApiError(body?.error, body?.message) ||
            "Could not create a payout request. No transfer was started.",
        )
        return
      }
      payoutIdempotencyRef.current = null
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
  }, [requestingPayout, snap])

  const onPreviewFee = useCallback(async () => {
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
      // Phase 3: quote via apiRequest (auth headers + humanized errors).
      const qRes = await apiRequest<{
        ok?: boolean
        error?: string
        message?: string
        gross?: number
        fee?: number
        net?: number
        recipientUsername?: string
      }>("/api/economy/earnings/quote", {
        method: "POST",
        body: { amountPi: snap.withdrawable },
        signal: controller.signal,
        timeoutMs: 15_000,
      })
      const body = qRes.data
      if (sequence !== quoteSequence.current) return
      if (!qRes.ok || !body?.ok) {
        setQuoteMsg(qRes.error || body?.message || body?.error || "Could not quote withdrawal.")
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
  }, [snap])

  const runWithdraw = useCallback(async () => {
    // Authorization is confirmed BEFORE any quote or payout request. When it is missing,
    // hand off to the withdrawal sheet, which runs genuine Pi consent and then quotes.
    if (walletAuthActive !== true) {
      openWithdrawSheet()
      return
    }
    if (!quoteDetail) {
      await onPreviewFee()
    }
    await onRequestPayout()
  }, [walletAuthActive, openWithdrawSheet, quoteDetail, onPreviewFee, onRequestPayout])


  useEffect(() => {
    const onFocus = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { action?: string } | undefined
      const action = detail?.action
      if (action === "withdraw") {
        void runWithdraw()
      } else if (action === "status") {
        void refresh()
        setPayoutMsg("Eligibility and linked Pi status are shown above. Withdraw stays on this card.")
      } else if (action === "linked") {
        openWithdrawSheet()
      }
    }
    window.addEventListener("ghc:wallet-pi-focus", onFocus as EventListener)
    return () => window.removeEventListener("ghc:wallet-pi-focus", onFocus as EventListener)
  }, [runWithdraw, refresh, openWithdrawSheet])

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
                void refresh()
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

  return (
    <section
      className={
        compact
          ? "overflow-hidden rounded-2xl border border-border/60 bg-card"
          : "mx-3 mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      }
      aria-label="Pi balance"
      data-pi-earnings-root
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
        <div className="mx-4 mb-2 rounded-xl border border-border/50 bg-muted/20 p-3 text-[12px]" data-quote-detail>
          <p className="font-semibold text-foreground">Withdrawal quote</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {quoteDetail.gross} π − {feePct}% fee ({quoteDetail.fee} π) →{" "}
            <span className="font-semibold text-foreground">{quoteDetail.net} π</span>
            {quoteDetail.recipientUsername ? ` → @${quoteDetail.recipientUsername}` : ""}
          </p>
        </div>
      ) : null}

      <div className="px-4 pb-3 space-y-2">
        {walletAuthActive !== true && snap.piWalletLinked === true ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground" role="status" data-wallet-auth-required>
            One-time Pi payout consent and fee preview happen when you tap Withdraw — not as separate buttons here.
          </p>
        ) : null}
        {/* Single primary control — hide when compact (wallet rail already owns the CTA). */}
        {!compact ? (
        <button
          type="button"
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("ghc:open-pi-withdraw"))
            } catch { /* */ }
          }}
          disabled={snap.piWalletLinked !== true}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-violet-700 px-4 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50"
          data-primary-withdraw="withdraw"
          data-testid="wallet-withdraw-cta"
          aria-label="Withdraw to Pi wallet"
        >
          Withdraw
        </button>
        ) : (
          <p className="text-center text-[11px] text-muted-foreground" data-compact-withdraw-hint>
            Use <span className="font-semibold text-foreground">Withdraw</span> on the Pi rail above — one path for amount, consent, PIN and submit.
          </p>
        )}
        <p className="text-center text-[10px] text-muted-foreground">
          3% fee is calculated in the withdraw sheet. Manage payout consent in Settings if you need to revoke.
        </p>
        {payoutMsg ? (
          <p className="mt-2 text-center text-[12px] font-medium text-amber-800 dark:text-amber-200" role="status">
            {humanizeApiError(
              /^[A-Z][A-Z0-9_]{3,}$/.test(payoutMsg.trim()) ? payoutMsg.trim() : undefined,
              payoutMsg,
            )}
          </p>
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
