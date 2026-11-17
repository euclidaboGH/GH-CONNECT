"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HeartHandshake, RefreshCw, ShieldCheck } from "lucide-react"
import { formatPiAtomic, type CharityImpactSummary } from "@/lib/ecosystem/charity-impact"

type ApiPayload = { ok?: boolean; error?: string; durable?: boolean } & Partial<CharityImpactSummary>

function formatDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Date unavailable"
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date)
}

export function CharityImpactScreen({ onBack }: { onBack?: () => void }) {
  const [summary, setSummary] = useState<CharityImpactSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/ecosystem/charity/summary", {
      credentials: "include", cache: "no-store", headers: { Accept: "application/json" }, signal,
    })
    const payload = await response.json().catch(() => null) as ApiPayload | null
    if (signal?.aborted) return
    if (!response.ok || payload?.ok !== true || payload.durable !== true || typeof payload.totalAtomic !== "string" || !Array.isArray(payload.items)) {
      throw new Error(payload?.error || "Your impact summary is unavailable")
    }
    setSummary({
      totalAtomic: payload.totalAtomic,
      contributionCount: Number.isSafeInteger(payload.contributionCount) ? Number(payload.contributionCount) : 0,
      items: payload.items,
      withdrawable: false,
      segregated: true,
    })
    setError(null)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    void refresh(controller.signal)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your impact summary is unavailable") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); requestRef.current = null }
  }, [refresh])

  const retry = useCallback(() => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(null)
    void refresh(controller.signal)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your impact summary is unavailable") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
  }, [refresh])

  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-labelledby="charity-impact-title">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        {onBack ? <button type="button" onClick={onBack} className="min-h-11 min-w-11 rounded-full border border-border text-sm" aria-label="Back">←</button> : null}
        <div className="min-w-0 flex-1"><h1 id="charity-impact-title" className="text-base font-semibold">Charity & Impact</h1><p className="text-xs text-muted-foreground">Your recorded contributions</p></div>
        <HeartHandshake className="h-6 w-6 text-emerald-700" aria-hidden="true" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 rounded-2xl border border-emerald-700/15 bg-emerald-700/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" /> Segregated charity record</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Recorded charity contributions are separate from available and withdrawable PI earnings. This screen is a read-only record; it does not initiate donations or payments.</p>
        </div>

        {error ? <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><span>{error}</span><button type="button" onClick={retry} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3"><RefreshCw className="h-4 w-4" /> Retry</button></div> : null}
        {loading ? <div className="grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-28 animate-pulse rounded-2xl bg-muted" /></div> : null}
        {!loading && summary ? <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Recorded contribution total</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatPiAtomic(summary.totalAtomic)} π</p><p className="mt-1 text-[11px] text-muted-foreground">Not available for withdrawal</p></div>
            <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Recorded contributions</p><p className="mt-2 text-2xl font-bold tabular-nums">{summary.contributionCount.toLocaleString()}</p><p className="mt-1 text-[11px] text-muted-foreground">Canonical ledger count</p></div>
          </div>
          <div className="mt-5">
            <h2 className="text-sm font-semibold">Recent contributions</h2>
            {summary.items.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center"><HeartHandshake className="mx-auto mb-2 h-7 w-7 text-muted-foreground" /><p className="text-sm font-medium">No recorded contributions yet</p><p className="mt-1 text-xs text-muted-foreground">When a contribution is recorded in the canonical charity ledger, it will appear here.</p></div> : <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {summary.items.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.campaignKey.replace(/[_-]+/g, " ")}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{formatDate(item.createdAt)} · Recorded</p></div><p className="shrink-0 text-sm font-semibold tabular-nums">{formatPiAtomic(item.amountAtomic)} π</p></li>)}
            </ul>}
          </div>
        </> : null}
      </div>
    </section>
  )
}
