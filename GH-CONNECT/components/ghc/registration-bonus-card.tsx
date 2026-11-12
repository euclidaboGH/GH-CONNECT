"use client"

/**
 * Phase 3 — One-time 3 π registration bonus claim + legacy 2.95 π reconciliation.
 * Server-authoritative: never invents a balance on the client.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Gift, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react"

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

  // Legacy v1 claimants auto-reconcile once when the card loads and is claimable.
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
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: { message: body.message || "2.95 π top-up credited", type: "success" },
          }),
        )
      } catch {
        if (!cancelled) setMsg("Bonus reconciliation is temporarily unavailable. Please retry later.")
      } finally {
        if (!cancelled) setClaiming(false)
      }
    })()
    return () => {
      cancelled = true
    }
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
      const amount = body.amountPi ?? status.amountPi ?? 3
      setMsg(body.message || "Registration bonus credited.")
      setStatus(body)
      try {
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "registration-bonus" } }))
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh", { detail: { reason: "registration-bonus" } }))
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: {
              message: body.message || `${amount} π registration bonus claimed`,
              type: "success",
            },
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

  // Migration pending while feature enabled
  if (status?.error === "EARNINGS_LEDGER_UNAVAILABLE" || status?.error === "UNAVAILABLE") {
    if (status.enabled === true) {
      return (
        <section
          className={`rounded-2xl border border-amber-500/30 bg-amber-50/80 p-3.5 dark:bg-amber-950/30 ${compact ? "mx-0" : "mx-3 mt-3"}`}
          aria-label="Registration bonus pending infrastructure"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-foreground">Registration bonus (3 π)</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                The earnings ledger is not ready for claims yet. Operator must apply migration{" "}
                <span className="font-mono text-[11px]">20261030010001_registration_bonus_v2_reconciliation.sql</span>{" "}
                and ensure the service role can call the claim RPC. No balances are invented on the client.
              </p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-2 rounded-full border border-amber-600/40 px-3 py-1 text-[11px] font-bold text-amber-900"
              >
                Retry status
              </button>
            </div>
          </div>
        </section>
      )
    }
    return null
  }

  if (status?.error === "LEGACY_BONUS_REVIEW_REQUIRED") {
    return (
      <section
        className={`rounded-2xl border border-amber-500/30 bg-amber-50/80 p-3.5 dark:bg-amber-950/30 ${compact ? "mx-0" : "mx-3 mt-3"}`}
        aria-label="Registration bonus needs review"
      >
        <p className="text-[13px] font-bold text-foreground">Registration bonus needs review</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {status.message || "A historical registration-bonus entry does not match the verified 0.05 π policy."}
        </p>
      </section>
    )
  }

  const amount = status?.amountPi ?? 3
  const isLegacy = Boolean(status?.legacyClaimed && !status?.claimed)
  const isClaimable = Boolean(status?.claimable)
  const isClaimed = Boolean(status?.claimed)

  // Compact claimed chip for Rewards
  if (compact && isClaimed) {
    return (
      <div className="mx-0 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-50/60 px-3 py-2 dark:bg-emerald-950/20">
        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
        <p className="text-[12px] font-semibold text-emerald-900 dark:text-emerald-200">Registration bonus claimed (3 π total)</p>
      </div>
    )
  }

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm"
          : isClaimable
            ? "mx-3 mt-3 rounded-2xl border border-emerald-600/30 bg-gradient-to-br from-emerald-50 via-card to-card p-4 shadow-sm dark:from-emerald-950/40 dark:to-card"
            : "mx-3 mt-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm"
      }
      aria-label="Registration bonus"
    >
      <div className="flex items-start gap-3">
        <div
          className={
            isClaimable
              ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700/90 text-white"
          }
        >
          {isClaimable ? <Sparkles className="h-5 w-5" aria-hidden /> : <Gift className="h-5 w-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-foreground">
            {isLegacy ? "Complete your 3 π registration bonus" : isClaimed ? "Registration bonus claimed" : "Registration bonus"}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {isLegacy ? (
              <>
                You already received <span className="font-semibold">0.05 π</span>. Claim the remaining{" "}
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">2.95 π</span> so your ledger totals{" "}
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">3 π</span>.
              </>
            ) : isClaimed ? (
              <>Policy total of <span className="font-semibold text-emerald-800 dark:text-emerald-300">3 π</span> is in your PI earnings ledger.</>
            ) : (
              <>
                One-time <span className="font-semibold text-emerald-800 dark:text-emerald-300">3 π</span> credited to your PI
                earnings ledger. Withdrawable to your linked KYC’d Pi wallet when eligible.
              </>
            )}
          </p>

          {isClaimed ? (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-700/10 px-3 py-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Claimed (3 π total)
            </div>
          ) : isClaimable ? (
            <button
              type="button"
              disabled={claiming}
              onClick={() => void onClaim()}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 text-[14px] font-bold text-white shadow-md transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-60"
            >
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              {claiming
                ? isLegacy
                  ? "Reconciling…"
                  : "Claiming…"
                : isLegacy
                  ? `Claim remaining ${amount} π`
                  : `Claim ${amount} π now`}
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
