"use client"

/**
 * Phase 8 — Unified PI earnings & payout dashboard.
 * Server-authoritative: /api/economy/earnings/withdrawable + /api/economy/earnings
 * Never invents balances. Explains ineligible / review / fee states clearly.
 */

import { useCallback, useEffect, useState } from "react"
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
  try {
    if (typeof value === "number" && Number.isFinite(value)) {
      return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} π`
    }
    const s = String(value ?? "")
    if (/^\d{1,38}$/.test(s)) {
      const atomic = BigInt(s)
      const whole = atomic / BigInt(10000000)
      const frac = (atomic % BigInt(10000000)).toString().padStart(7, "0").replace(/0+$/, "") || "0"
      return `${whole.toLocaleString()}.${frac} π`
    }
  } catch {
    /* fall through */
  }
  return "0 π"
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
      return "Authorize Pi wallet payouts in Identity settings."
    default:
      return code.replace(/_/g, " ").toLowerCase()
  }
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
  const [quoting, setQuoting] = useState(false)
  const [charityTotal, setCharityTotal] = useState<string | null>(null)
  const [charityCount, setCharityCount] = useState(0)
  const [crossFindings, setCrossFindings] = useState<string[]>([])

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
        report?: { findings?: Array<{ code?: string; severity?: string; message?: string }> }
      } | null
      if (xRes.ok && xJson?.ok && Array.isArray(xJson.report?.findings)) {
        setCrossFindings(
          xJson.report!.findings!
            .filter((f) => f.severity === "attention")
            .map((f) => f.message || f.code || "")
            .filter(Boolean)
            .slice(0, 3),
        )
      } else {
        setCrossFindings([])
      }

      if (!wRes.ok || !wJson?.ok) {
        setFailed(true)
        setSnap(null)
      } else {
        setFailed(false)
        setSnap(wJson)
      }
      if (sRes.ok && sJson?.ok && Array.isArray(sJson.entries)) {
        setEntries(sJson.entries)
      } else {
        setEntries([])
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
    void refresh(ac.signal)
    const onRefresh = () => void refresh()
    window.addEventListener("ghc:wallet-refresh", onRefresh)
    window.addEventListener("ghc:earnings-refresh", onRefresh)
    return () => {
      ac.abort()
      window.removeEventListener("ghc:wallet-refresh", onRefresh)
      window.removeEventListener("ghc:earnings-refresh", onRefresh)
    }
  }, [refresh])

  const onPreviewFee = async () => {
    if (!snap?.withdrawable || snap.withdrawable <= 0) {
      setQuoteMsg("Nothing available to quote.")
      return
    }
    setQuoting(true)
    setQuoteMsg(null)
    try {
      const res = await fetch("/api/economy/earnings/quote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amountPi: snap.withdrawable }),
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
      if (!res.ok || !body?.ok) {
        setQuoteMsg(body?.message || body?.error || "Could not quote withdrawal.")
        return
      }
      setQuoteMsg(
        `Gross ${body.gross} π → fee ${body.fee} π (3%) → net ${body.net} π` +
          (body.recipientUsername ? ` to @${body.recipientUsername}` : " to your linked Pi wallet"),
      )
    } catch {
      setQuoteMsg("Quote unavailable. Try again.")
    } finally {
      setQuoting(false)
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
              onClick={() => void refresh()}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-950 shadow-sm"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      </section>
    )
  }

  const reasons = Array.isArray(snap.reasons) ? snap.reasons : []
  const feePct = snap.feePercent ?? (snap.feeBps != null ? snap.feeBps / 100 : 3)

  return (
    <section
      className="mx-3 mt-3 overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-b from-emerald-50/90 to-white shadow-sm"
      aria-label="PI earnings dashboard"
    >
      <div className="flex items-center justify-between gap-2 border-b border-emerald-900/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-emerald-950">PI earnings</h2>
            <p className="text-[11px] text-emerald-900/70">Server ledger · not GHC</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-full p-2 text-emerald-800 hover:bg-emerald-100"
          aria-label="Refresh earnings"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-4 pt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-900/60">Withdrawable</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-950">
          {atomicToDisplay(snap.withdrawable ?? snap.withdrawableAtomic)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Available", value: snap.available ?? snap.availableAtomic },
            { label: "Pending", value: snap.pending ?? snap.pendingAtomic },
            { label: "Reserved", value: snap.reserved ?? snap.reservedAtomic },
            { label: "Paid", value: snap.paid ?? snap.paidAtomic },
          ].map((cell) => (
            <div key={cell.label} className="rounded-xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-black/5">
              <p className="text-[10px] font-medium uppercase text-slate-500">{cell.label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                {atomicToDisplay(cell.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2 px-4">
        {crossFindings.length > 0 ? (
          <div className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200/80">
            <p className="text-[11px] font-semibold text-amber-950">Cross-feature attention</p>
            <ul className="mt-1 list-inside list-disc text-[11px] text-amber-900/90">
              {crossFindings.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {charityTotal != null ? (
          <div className="flex items-start gap-2 rounded-xl bg-white/90 px-3 py-2 ring-1 ring-black/5">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
            <p className="text-xs text-slate-700">
              Charity given: <strong>{charityTotal}</strong>
              {charityCount > 0 ? ` (${charityCount} gifts)` : ""}. Charity is separate from withdrawable earnings.
            </p>
          </div>
        ) : null}
        <div className="flex items-start gap-2 rounded-xl bg-white/90 px-3 py-2 ring-1 ring-black/5">
          <Percent className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <p className="text-xs text-slate-700">
            Withdrawal fee <strong>{feePct}%</strong> of gross. Net is sent to your{" "}
            <strong>Pi wallet linked at sign-in</strong>
            {snap.linkedPiUsername ? (
              <>
                {" "}
                (<span className="font-medium">@{snap.linkedPiUsername}</span>)
              </>
            ) : null}
            .
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-white/90 px-3 py-2 ring-1 ring-black/5">
          {snap.piWalletLinked ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          )}
          <p className="text-xs text-slate-700">
            {snap.piWalletLinked
              ? "Pi identity linked for payouts."
              : "Pi identity not linked — sign in with Pi to enable withdrawals."}
          </p>
        </div>

        {snap.eligible === true ? (
          <div className="flex items-start gap-2 rounded-xl bg-emerald-100/80 px-3 py-2">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
            <p className="text-xs text-emerald-950">
              Eligible to withdraw (subject to Testnet A2U and operator gates). Min{" "}
              {snap.minPayout != null ? `${snap.minPayout} π` : "policy minimum"}.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200/80">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <p className="text-xs font-medium text-amber-950">Not eligible to withdraw yet</p>
                <ul className="mt-1 list-inside list-disc text-[11px] text-amber-900/90">
                  {reasons.length > 0 ? (
                    reasons.map((r) => <li key={r}>{reasonLabel(String(r))}</li>)
                  ) : (
                    <li>Complete linking and wait for available balance.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pb-1">
          <button
            type="button"
            disabled={quoting || !(snap.withdrawable && snap.withdrawable > 0)}
            onClick={() => void onPreviewFee()}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {quoting ? "Quoting…" : "Preview 3% fee"}
          </button>
        </div>
        {quoteMsg ? <p className="pb-2 text-[11px] text-slate-600">{quoteMsg}</p> : null}
      </div>

      {!compact && (
        <div className="border-t border-emerald-900/5 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent ledger</p>
          {entries.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No earnings ledger entries yet.</p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
              {entries.map((e, i) => (
                <li
                  key={e.id || e.unique_ref || String(i)}
                  className="flex items-start justify-between gap-2 rounded-lg bg-white px-2.5 py-2 ring-1 ring-black/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-900">
                      {e.entry_type || "entry"} · {e.source_kind || "—"}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {e.unique_ref || e.payout_request_id || e.reason || "—"}
                    </p>
                    {e.created_at ? (
                      <p className="text-[10px] text-slate-400">
                        {new Date(e.created_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold tabular-nums text-slate-900">
                      {atomicToDisplay(e.amount_atomic)}
                    </p>
                    <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusTone(e.status)}`}>
                      {e.status || "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
