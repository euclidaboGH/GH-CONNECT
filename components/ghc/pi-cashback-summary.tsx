"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, ChevronRight, RefreshCw, ShieldCheck } from "lucide-react"

type CashbackItem = {
  entitlement_id?: string
  period_id?: string
  starts_at?: string
  ends_at?: string
  cashback_amount_atomic?: string
  eligible_net_revenue_atomic?: string
  status?: "calculated" | "needs_review"
  financial_state?: string
}

type CashbackPayload = {
  ok?: boolean
  featureAvailable?: boolean
  calculatedAtomic?: string
  needsReviewAtomic?: string
  withdrawalEnabled?: boolean
  items?: CashbackItem[]
}

function formatPiAtomic(value: string | undefined): string {
  if (!value || !/^\d{1,38}$/.test(value)) return "0.0000000 π"
  try {
    const atomic = BigInt(value)
    const whole = atomic / 10_000_000n
    const fraction = (atomic % 10_000_000n).toString().padStart(7, "0")
    return `${whole.toLocaleString()}\u002e${fraction} π`
  } catch {
    return "0.0000000 π"
  }
}

function formatDate(value: string | undefined): string {
  if (!value) return "Period unavailable"
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "Period unavailable"
}

export function PiCashbackSummary() {
  const [payload, setPayload] = useState<CashbackPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimMessage, setClaimMessage] = useState<string | null>(null)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const response = await fetch("/api/economy/rewards/pi-cashback", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      })
      const result = await response.json().catch(() => null) as CashbackPayload | null
      if (!response.ok || !result?.ok || result.featureAvailable !== true) {
        setFailed(true)
        setPayload(null)
        return
      }
      setFailed(false)
      setPayload(result)
    } catch {
      if (!signal?.aborted) {
        setFailed(true)
        setPayload(null)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const claimCashback = useCallback(async () => {
    if (claiming || !payload?.withdrawalEnabled || !payload.calculatedAtomic || !/^\d+$/.test(payload.calculatedAtomic) || BigInt(payload.calculatedAtomic) <= 0n) return
    setClaiming(true)
    setClaimMessage(null)
    try {
      const response = await fetch("/api/economy/rewards/pi-cashback/claim", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; message?: string; amount?: number; txid?: string; status?: string } | null
      if (!response.ok || !result?.ok) {
        const messages: Record<string, string> = {
          NO_WITHDRAWABLE_CASHBACK: "No finalized cashback is available to withdraw yet.",
          VERIFIED_PI_RECIPIENT_REQUIRED: "Sign in with your linked Pi account before withdrawing.",
          PI_A2U_SEQUENCE_BUSY: "Another Pi Testnet payout is processing. Please retry shortly.",
          CASHBACK_PAYOUT_REQUIRES_OPERATOR_REVIEW: "This payout needs support review before it can continue.",
        }
        setClaimMessage(messages[String(result?.error || "")] || result?.message || "The payout could not be confirmed. Refresh the statement before retrying.")
        await refresh()
        return
      }
      setClaimMessage(result.status === "paid" ? `Pi Testnet transfer confirmed: ${formatPiAtomic(String(Math.round(Number(result.amount || 0) * 10_000_000)))}${result.txid ? ` · Tx ${result.txid}` : ""}` : "Payout status updated. Refreshing your statement.")
      await refresh()
    } catch {
      setClaimMessage("The payout response was interrupted. Refresh the statement to reconcile status before retrying.")
      await refresh()
    } finally {
      setClaiming(false)
    }
  }, [claiming, payload, refresh])

  // Do not show a fake zero balance when the migration or service is unavailable.
  if (!payload && (failed || loading)) return null

  return (
    <section className="mx-3 mt-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-card p-4 shadow-[var(--gh-card-shadow)] dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-card" aria-label="Pi cashback (0.5% quarterly) statement">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
          <CalendarClock size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">Pi cashback</h2>
            <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-8 items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 text-[10px] font-semibold text-muted-foreground disabled:opacity-50" aria-label="Refresh Pi cashback">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">0.5% of your eligible Pi spend, calculated at the end of each calendar quarter (UTC). Claim after the quarter is finalized.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/60 bg-background/80 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground">Calculated cashback</p>
          <p className="mt-1 text-sm font-extrabold tabular-nums text-foreground">{loading && !payload ? "Loading…" : formatPiAtomic(payload?.calculatedAtomic)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/80 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground">Under review</p>
          <p className="mt-1 text-sm font-extrabold tabular-nums text-foreground">{loading && !payload ? "Loading…" : formatPiAtomic(payload?.needsReviewAtomic)}</p>
        </div>
      </div>

      {payload?.withdrawalEnabled && payload.calculatedAtomic && /^\d+$/.test(payload.calculatedAtomic) && BigInt(payload.calculatedAtomic) > 0n ? (
        <div className="mt-3 space-y-2">
          <button type="button" onClick={() => void claimCashback()} disabled={claiming || loading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
            {claiming ? <RefreshCw size={14} className="animate-spin" aria-hidden /> : <ShieldCheck size={14} aria-hidden />}
            {claiming ? "Verifying Pi Testnet transfer…" : "Withdraw finalized cashback to Pi wallet"}
          </button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">Testnet only. A payout is shown as paid only after the Pi provider confirms the matching recipient, amount and verified transaction.</p>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
          <p className="text-[10px] leading-relaxed text-amber-950 dark:text-amber-100">{payload?.withdrawalEnabled ? "No finalized cashback is currently available to withdraw." : "Pi withdrawals remain disabled until the Testnet A2U payout migration, server credentials, wallet funding and end-to-end verification are complete. Mainnet payouts are not enabled by this release."}</p>
        </div>
      )}
      {claimMessage ? <p role="status" aria-live="polite" className="mt-2 break-words rounded-lg border border-border/60 bg-background/70 p-2 text-[10px] leading-relaxed text-foreground">{claimMessage}</p> : null}

      {payload?.items?.length ? (
        <div className="mt-3 space-y-2">
          <h3 className="text-[11px] font-bold text-foreground">Recent four-month statements</h3>
          {payload.items.slice(0, 4).map((item, index) => (
            <div key={item.entitlement_id || `${item.period_id || "period"}-${index}`} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/60 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground">{formatDate(item.starts_at)} – {formatDate(item.ends_at)}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{item.status === "needs_review" || item.financial_state === "needs_review" ? "Needs review" : item.financial_state === "paid" ? "Paid to Pi wallet" : item.financial_state === "payout_processing" ? "Payout processing" : "Calculated · not yet paid"}</p>
              </div>
              <p className="shrink-0 text-[11px] font-bold tabular-nums text-foreground">{formatPiAtomic(item.cashback_amount_atomic)}</p>
              <ChevronRight size={13} className="text-muted-foreground" aria-hidden />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
