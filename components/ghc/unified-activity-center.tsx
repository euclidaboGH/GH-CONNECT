"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, ChevronRight, RefreshCw, Wallet } from "lucide-react"
import { getBoundDomainServices } from "@/lib/domains/compat"
import type { GhcTransaction, RewardRecord } from "@/lib/domains/economy-types"
import { navigateGhcActivityTarget, resolveGhcActivityAttribution } from "@/lib/domains/ghc-activity-attribution"
import { IdentityService } from "@/lib/identity/identity-service"
import { useAccountFilterState } from "@/hooks/use-account-filter-state"
import { FilterSummary } from "./filtering/filter-summary"
import { FilterResultState } from "./filtering/filter-result-state"
import { matchesFilterQuery } from "@/lib/filtering/filter-utils"
import { matchesFilterDateRange } from "@/lib/filtering/filter-contract"

type Filter = "all" | "social" | "community" | "marketplace" | "reward" | "transfer"
type Row = { key: string; at: number; tx?: GhcTransaction; reward?: RewardRecord }
type ActivityFilters = { category: Filter; query: string; from: string; to: string }
const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = { category: "all", query: "", from: "", to: "" }
function validateActivityFilters(value: unknown): ActivityFilters {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00.000Z`)) && new Date(`${v}T00:00:00.000Z`).toISOString().slice(0,10) === v ? v : ""
  const from = date(raw.from), to = date(raw.to)
  return { category: ["all", "social", "community", "marketplace", "reward", "transfer"].includes(String(raw.category)) ? raw.category as Filter : "all", query: typeof raw.query === "string" ? raw.query.slice(0,120) : "", from: from && to && from > to ? "" : from, to: from && to && from > to ? "" : to }
}

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const when = (ts: number) => { try { return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) } catch { return "" } }

export function UnifiedActivityCenter({ limit = 30 }: { limit?: number }) {
  const accountId = IdentityService.getCurrentUserId() || "anonymous"
  const filters = useAccountFilterState("unified-activity", accountId, DEFAULT_ACTIVITY_FILTERS, validateActivityFilters)
  const { category: filter, query, from, to } = filters.value
  const [tick, setTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(() => {
    setRefreshing(true)
    setTick((v) => v + 1)
    window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
    window.setTimeout(() => setRefreshing(false), 250)
  }, [])

  useEffect(() => {
    const sync = () => setTick((v) => v + 1)
    window.addEventListener("ghc:wallet-refresh", sync)
    window.addEventListener("ghc:curation-updated", sync)
    window.addEventListener("ghc:post-engagement", sync)
    window.addEventListener("ghc:reward-claimed", sync)
    return () => {
      window.removeEventListener("ghc:wallet-refresh", sync)
      window.removeEventListener("ghc:curation-updated", sync)
      window.removeEventListener("ghc:post-engagement", sync)
      window.removeEventListener("ghc:reward-claimed", sync)
    }
  }, [])

  const result = useMemo((): { rows: Row[]; error: boolean } => {
    void tick
    try {
      const eco = getBoundDomainServices()?.economy
      const txs = (eco?.getTransactions?.(limit) || []) as GhcTransaction[]
      const rewards = (eco?.getRewards?.(limit) || []) as RewardRecord[]
      const txRewardIds = new Set(txs.map((tx) => String(tx.referenceId || tx.metadata?.rewardId || tx.metadata?.reward_id || "")).filter(Boolean))
      return { rows: [...txs.map((tx) => ({ key: `tx:${tx.id}`, at: tx.createdAt, tx })), ...rewards.filter((r) => !txRewardIds.has(String(r.id))).map((reward) => ({ key: `reward:${reward.id}`, at: reward.createdAt, reward }))].sort((a, b) => b.at - a.at).slice(0, limit), error: false }
    } catch { return { rows: [], error: true } }
  }, [limit, tick])

  const visible = useMemo(() => result.rows.filter((row) => {
    if (filter !== "all") {
      if (row.reward && filter !== "reward") return false
      if (row.tx) {
        const category = resolveGhcActivityAttribution(row.tx).category
        if (category !== filter && !(filter === "reward" && category === "membership")) return false
      }
    }
    if (!matchesFilterDateRange(row.at, { from: from || null, to: to || null })) return false
    return matchesFilterQuery(query, row.reward?.reason, row.reward?.sourceEvent, row.tx?.reason, row.tx?.sourceEvent, row.tx?.referenceId)
  }), [filter, from, query, result.rows, to])

  const activeItems = [
    ...(filter !== "all" ? [{ id: "category", label: `Type: ${filter}`, onRemove: () => filters.update("category", "all" as Filter) }] : []),
    ...(query ? [{ id: "query", label: `Search: ${query}`, onRemove: () => filters.update("query", "") }] : []),
    ...(from ? [{ id: "from", label: `From: ${from}`, onRemove: () => filters.update("from", "") }] : []),
    ...(to ? [{ id: "to", label: `To: ${to}`, onRemove: () => filters.update("to", "") }] : []),
  ]

  const openReward = (_reward: RewardRecord) => {
    window.dispatchEvent(new CustomEvent("ghc:open-rewards"))
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-rewards-tab", { detail: "history" })), 80)
  }

  return <section className="rounded-2xl border border-border/70 bg-card p-3" aria-label="Activity Center">
    <div className="flex items-center justify-between gap-2">
      <div><h3 className="text-sm font-bold">Activity Center</h3><p className="text-[11px] text-muted-foreground">One timeline for wallet, rewards and linked product activity</p></div>
      <button type="button" onClick={refresh} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Refresh activity"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""}/></button>
    </div>
    <label className="mt-3 block"><span className="sr-only">Search activity</span><input value={query} onChange={(event) => filters.update("query", event.target.value)} placeholder="Search activity" className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Activity type filter">
      {(["all","social","community","marketplace","reward","transfer"] as Filter[]).map((id) => <button key={id} type="button" onClick={() => filters.update("category", id)} aria-pressed={filter === id} className={`min-h-9 shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filter === id ? "bg-emerald-700 text-white" : "bg-muted text-muted-foreground"}`}>{id}</button>)}
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-muted-foreground">From<input type="date" value={from} max={to || undefined} onChange={(event) => filters.update("from", event.target.value)} className="mt-1 min-h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></label><label className="text-[10px] font-semibold text-muted-foreground">To<input type="date" value={to} min={from || undefined} onChange={(event) => filters.update("to", event.target.value)} className="mt-1 min-h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></label></div>
    <FilterSummary className="mt-2" items={activeItems} onClearAll={() => filters.reset()} />
    <p className="mt-2 text-[10px] text-muted-foreground" role="note">Showing the latest {limit} locally available activity records; this compact view is not a complete server ledger.</p>
    <div className="mt-2 divide-y divide-border/60">
      {result.error ? <FilterResultState state="error" description="Activity could not be read from the local activity service." onRetry={refresh}/> : result.rows.length === 0 ? <FilterResultState state="empty" title="No activity yet" description="New verified activity will appear here when available."/> : visible.length === 0 ? <FilterResultState state="no-results"/> : visible.map((row) => {
        if (row.reward) return <button key={row.key} type="button" onClick={() => openReward(row.reward!)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/30"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><Bell size={15}/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{row.reward.reason || row.reward.sourceEvent || "Reward activity"}</span><span className="block text-[10px] text-muted-foreground">{when(row.at)} · {String(row.reward.validationStatus).replace(/_/g," ")}</span></span><span className="text-xs font-bold text-emerald-700">+{fmt(row.reward.amount)} GHC</span><ChevronRight size={14}/></button>
        const a = resolveGhcActivityAttribution(row.tx!)
        const open = () => a.target ? navigateGhcActivityTarget(a.target) : (window.dispatchEvent(new CustomEvent("ghc:open-wallet")), true)
        return <button key={row.key} type="button" onClick={open} className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/30"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><Wallet size={15}/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{a.label}</span><span className="block truncate text-[10px] text-muted-foreground">{row.tx!.reason || row.tx!.sourceEvent} · {when(row.at)}</span></span><span className={`text-xs font-bold ${row.tx!.amount >= 0 ? "text-emerald-700" : "text-foreground"}`}>{row.tx!.amount >= 0 ? "+" : ""}{fmt(row.tx!.amount)} GHC</span><ChevronRight size={14}/></button>
      })}
    </div>
  </section>
}
