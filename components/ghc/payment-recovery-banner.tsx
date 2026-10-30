"use client"

/**
 * Phase 18 — wallet banner for payments that may need recovery / fulfilment.
 * Data only from GET /api/payments/recovery/status (owned intents).
 */
import { useCallback, useEffect, useState } from "react"
import { RefreshCw, AlertCircle } from "lucide-react"
import { coordinatedRecoverPayment } from "@/lib/payments/coordinated-recovery"
import { fulfilPaymentIntent } from "@/lib/payments/fulfilment-client"

type RecoveryItem = {
  id: string
  status?: string
  purpose?: string
  amount?: number
  currency?: string
  mayNeedProviderLookup?: boolean
  mayNeedFulfilment?: boolean
}

export function PaymentRecoveryBanner() {
  const [items, setItems] = useState<RecoveryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/payments/recovery/status", {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok && Array.isArray(data.items)) {
        setItems(data.items.slice(0, 5))
      } else {
        setItems([])
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const onRecovered = () => void load()
    window.addEventListener("ghc:payment-recovered", onRecovered)
    window.addEventListener("ghc:wallet-refresh", onRecovered)
    return () => {
      window.removeEventListener("ghc:payment-recovered", onRecovered)
      window.removeEventListener("ghc:wallet-refresh", onRecovered)
    }
  }, [load])

  if (!loading && items.length === 0) return null

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3" role="region" aria-label="Payment recovery">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} className="text-amber-700 dark:text-amber-300" aria-hidden />
          <p className="text-xs font-bold text-amber-950 dark:text-amber-100">Payments needing attention</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full p-1.5 text-amber-800 hover:bg-amber-500/15 dark:text-amber-200"
          aria-label="Refresh recovery list"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        Only your durable payment intents are listed. Recovery never invents provider history or grants benefits without server rules.
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/80 px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold">
                {String(item.purpose || "payment").replaceAll("_", " ")} · {String(item.status || "—")}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {item.amount != null ? `${item.amount} ${item.currency || "PI"}` : item.id.slice(0, 12)}
              </p>
            </div>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => {
                setBusyId(item.id)
                setMsg(null)
                void (async () => {
                  try {
                    if (item.mayNeedFulfilment && !item.mayNeedProviderLookup) {
                      const f = await fulfilPaymentIntent({ intentId: item.id })
                      setMsg(
                        f.ok
                          ? f.featureFulfilment?.[0]?.message || "Fulfilment requested"
                          : f.error || "Fulfilment failed",
                      )
                    } else {
                      const r = await coordinatedRecoverPayment(item.id, { purpose: item.purpose })
                      setMsg(
                        r.ok
                          ? r.fulfilment?.message ||
                              r.intentRecover?.message ||
                              `Status: ${r.intentRecover?.intent?.status || "updated"}`
                          : r.error || "Recovery failed",
                      )
                    }
                    await load()
                  } catch {
                    setMsg("Request failed")
                  } finally {
                    setBusyId(null)
                  }
                })()
              }}
              className="shrink-0 rounded-full bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
            >
              {busyId === item.id ? "…" : item.mayNeedFulfilment ? "Fulfil" : "Recover"}
            </button>
          </li>
        ))}
      </ul>
      {msg ? (
        <p className="mt-2 text-[10px] text-muted-foreground" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
