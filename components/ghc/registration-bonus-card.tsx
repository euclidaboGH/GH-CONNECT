"use client"

/**
 * One-time 3 π registration bonus claim and legacy reconciliation control.
 * Server-authoritative: never invents a balance on the client.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Gift, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

type BonusStatus = {
  ok?: boolean
  enabled?: boolean
  amountPi?: number
  claimable?: boolean
  claimed?: boolean
  legacyClaimed?: boolean
  message?: string
  error?: string
  reasons?: string[]
}

export function RegistrationBonusCard({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<BonusStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const autoReconcileStarted = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const res = await fetch("/api/economy/earnings/registration-bonus", {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal,
      })
      const body = (await res.json().catch(() => null)) as BonusStatus | null
      if (signal?.aborted) return
      if (!body) {
        setStatus({ ok: false, error: "UNAVAILABLE", message: "Could not load registration bonus status." })
        return
      }
      setStatus(body)
    } catch {
      if (!signal?.aborted) {
        setStatus({ ok: false, error: "UNAVAILABLE", message: "Could not load registration bonus status." })
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

  // Existing v1 claimants are topped up automatically when the bonus card is loaded.
  // New users still explicitly claim their 3 PI bonus.
  useEffect(() => {
    if (loading || !status?.enabled || !status.legacyClaimed || !status.claimable || autoReconcileStarted.current) return
    autoReconcileStarted.current = true
    let cancelled = false
    setClaiming(true)
    void (async () => {
      try {
        const res = await fetch("/api/economy/earnings/registration-bonus", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const body = (await res.json().catch(() => null)) as BonusStatus | null
        if (cancelled) return
        if (!res.ok || !body?.ok) {
          setMsg(body?.message || body?.error || "Bonus reconciliation is temporarily unavailable. Please retry later.")
          await refresh()
          return
        }
        setStatus(body)
        setMsg(body.message || "Remaining registration bonus reconciled.")
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "registration-bonus-reconciliation" } }))
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh", { detail: { reason: "registration-bonus-reconciliation" } }))
      } catch {
        if (!cancelled) setMsg("Bonus reconciliation is temporarily unavailable. Please retry later.")
      } finally {
        if (!cancelled) setClaiming(false)
      }
    })()
    return () => { cancelled = true }
  }, [loading, status, refresh])

  const onClaim = async () => {
    if (claiming || !status?.claimable) return
    setClaiming(true)
    setMsg(null)
    try {
      const res = await fetch("/api/economy/earnings/registration-bonus", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const body = (await res.json().catch(() => null)) as BonusStatus | null
      if (!res.ok || !body?.ok) {
        setMsg(body?.message || body?.error || "Claim failed. No balance was invented.")
        await refresh()
        return
      }
      setMsg(body.message || "Registration bonus credited.")
      setStatus(body)
      try {
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "registration-bonus" } }))
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh", { detail: { reason: "registration-bonus" } }))
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: { message: body.message || `${body.amountPi ?? amount} π registration bonus claimed`, type: "success" },
          }),
        )
      } catch {
        /* */
      }
    } catch {
      setMsg("Claim unavailable. Try again.")
    } finally {
      setClaiming(false)
    }
  }

  // Hide completely when disabled and not claimed (giveaway paused)
  if (!loading && status && status.enabled === false && !status.claimed) {
    return null
  }

  if (loading && !status) {
    return (
      <section className={`rounded-2xl border border-border/60 bg-card p-3 ${compact ? "mx-0" : "mx-3 mt-3"}`}>
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <p className="mt-2 text-[11px] text-muted-foreground">Checking registration bonus…</p>
      </section>
    )
  }

  // Avoid duplicate noisy banners — wallet/dashboard already surface ledger health.
  if (status?.error === "EARNINGS_LEDGER_UNAVAILABLE" || status?.error === "UNAVAILABLE") {
    return null
  }

  const amount = status?.amountPi ?? 3

  return (
    <section
      className={`rounded-2xl border border-emerald-600/25 bg-gradient-to-br from-emerald-50/90 to-card p-3.5 shadow-sm dark:from-emerald-950/30 dark:to-card ${compact ? "mx-0" : "mx-3 mt-3"}`}
      aria-label="Registration bonus"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
          <Gift className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-foreground">Registration bonus</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Policy total: <span className="font-semibold text-emerald-800 dark:text-emerald-300">3 π</span> one-time registration bonus.
            {status?.legacyClaimed && !status?.claimed
              ? " You already received 0.05 π — claim the remaining 2.95 π to complete the 3 π total."
              : " Credited to your PI earnings ledger (withdraw to your linked Pi wallet when eligible)."}
          </p>

          {status?.claimed ? (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-700/10 px-3 py-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Claimed (3 π total)
            </div>
          ) : status?.claimable ? (
            <button
              type="button"
              disabled={claiming}
              onClick={() => void onClaim()}
              className="mt-2.5 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 text-[12px] font-bold text-white disabled:opacity-60"
            >
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              {claiming
                ? (status?.legacyClaimed ? "Reconciling…" : "Claiming…")
                : status?.legacyClaimed
                  ? `Claim remaining ${amount} π`
                  : `Claim ${amount} π`}
            </button>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {status?.message || status?.reasons?.[0] || "Not claimable right now."}
            </p>
          )}

          {msg ? <p className="mt-2 text-[11px] font-medium text-foreground">{msg}</p> : null}
        </div>
      </div>
    </section>
  )
}
