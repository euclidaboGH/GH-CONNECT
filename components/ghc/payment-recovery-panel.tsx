"use client"

/**
 * Lists durable payment intents that may need recovery or fulfilment.
 * Does not invent success — calls server recover/fulfill only when user acts.
 */

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"

type RecoveryItem = {
  id: string
  status: string
  purpose?: string
  amount?: number
  currency?: string
  mayNeedProviderLookup?: boolean
  mayNeedFulfilment?: boolean
  providerPaymentId?: string | null
}

export function PaymentRecoveryPanel({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<RecoveryItem[]>([])
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/payments/recovery/status", {
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setItems(Array.isArray(data.items) ? data.items : [])
        setNote(String(data.note || ""))
      } else {
        setItems([])
        setNote(String(data?.error || "Could not load payment recovery status"))
      }
    } catch {
      setItems([])
      setNote("Network error loading recovery status")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const fulfill = async (item: RecoveryItem) => {
    if (busyId) return
    setBusyId(item.id)
    setMessage(null)
    try {
      const res = await fetch("/api/payments/fulfill", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: item.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setMessage(String(data.message || "Fulfilment recorded"))
        try {
          window.dispatchEvent(new CustomEvent("ghc:payment-fulfilled", { detail: { intentId: item.id } }))
          window.dispatchEvent(new CustomEvent("ghc:wallet-synced"))
        } catch {
          /* */
        }
        await load()
      } else {
        setMessage(String(data?.message || data?.error || "Fulfilment not available yet"))
      }
    } catch {
      setMessage("Network error during fulfilment")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section
      className={`rounded-2xl border border-border/60 bg-card p-4 ${className}`}
      aria-label="Payment recovery"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">Payment recovery</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-2.5 text-[11px] font-semibold"
          disabled={loading}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Incomplete or paid-but-not-fulfilled π payments appear here. GHC balances are separate and are never invented from a payment status.
      </p>
      {message ? (
        <p className="mb-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[11px] font-medium text-foreground" role="status">
          {message}
        </p>
      ) : null}
      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CheckCircle2 size={14} className="text-emerald-600" />
          No payments need attention
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border/70 bg-background px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-foreground">
                    {item.purpose || "Payment"} · {String(item.status)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.amount != null ? `${item.amount} ${item.currency || "PI"}` : "Amount on receipt"}
                    {item.providerPaymentId ? ` · ${item.providerPaymentId.slice(0, 12)}…` : ""}
                  </p>
                </div>
                {item.mayNeedFulfilment ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void fulfill(item)}
                    className="shrink-0 rounded-full bg-[var(--gh-green)] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {busyId === item.id ? "Working…" : "Fulfil"}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                    <AlertCircle size={12} /> In progress
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {note ? <p className="mt-2 text-[10px] text-muted-foreground">{note}</p> : null}
    </section>
  )
}
