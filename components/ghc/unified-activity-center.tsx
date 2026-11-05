"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, ChevronRight, RefreshCw, Wallet } from "lucide-react"
import { getBoundDomainServices } from "@/lib/domains/compat"
import type { GhcTransaction, RewardRecord } from "@/lib/domains/economy-types"
import { navigateGhcActivityTarget, resolveGhcActivityAttribution } from "@/lib/domains/ghc-activity-attribution"

type Filter = "all" | "social" | "community" | "marketplace" | "reward" | "transfer"
type Row = { key: string; at: number; tx?: GhcTransaction; reward?: RewardRecord }

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const when = (ts: number) => { try { return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) } catch { return "" } }

export function UnifiedActivityCenter({ limit = 30 }: { limit?: number }) {
  const [filter, setFilter] = useState<Filter>("all")
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

  const rows = useMemo<Row[]>(() => {
    void tick
    try {
      const eco = getBoundDomainServices()?.economy
      const txs = (eco?.getTransactions?.(limit) || []) as GhcTransaction[]
      const rewards = (eco?.getRewards?.(limit) || []) as RewardRecord[]
      const txRewardIds = new Set(txs.map((tx) => String(tx.referenceId || tx.metadata?.rewardId || tx.metadata?.reward_id || "")).filter(Boolean))
      return [
        ...txs.map((tx) => ({ key: `tx:${tx.id}`, at: tx.createdAt, tx })),
        ...rewards.filter((r) => !txRewardIds.has(String(r.id))).map((reward) => ({ key: `reward:${reward.id}`, at: reward.createdAt, reward })),
      ].sort((a, b) => b.at - a.at).slice(0, limit)
    } catch { return [] }
  }, [limit, tick])

  const visible = useMemo(() => rows.filter((row) => {
    if (filter === "all") return true
    if (row.reward) return filter === "reward"
    const category = resolveGhcActivityAttribution(row.tx!).category
    return category === filter || (filter === "reward" && category === "membership")
  }), [filter, rows])

  const openReward = (reward: RewardRecord) => {
    window.dispatchEvent(new CustomEvent("ghc:open-rewards"))
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("ghc:open-rewards-tab", { detail: "history" })), 80)
  }

  return <section className="rounded-2xl border border-border/70 bg-card p-3" aria-label="Activity Center">
    <div className="flex items-center justify-between gap-2">
      <div><h3 className="text-sm font-bold">Activity Center</h3><p className="text-[11px] text-muted-foreground">One timeline for wallet, rewards and linked product activity</p></div>
      <button type="button" onClick={refresh} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted" aria-label="Refresh activity"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""}/></button>
    </div>
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
      {(["all","social","community","marketplace","reward","transfer"] as Filter[]).map((id) => <button key={id} type="button" onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold capitalize ${filter === id ? "bg-emerald-700 text-white" : "bg-muted text-muted-foreground"}`}>{id}</button>)}
    </div>
    <div className="mt-2 divide-y divide-border/60">
      {visible.length === 0 ? <div className="py-8 text-center text-xs text-muted-foreground">No verified activity in this filter yet.</div> : visible.map((row) => {
        if (row.reward) return <button key={row.key} type="button" onClick={() => openReward(row.reward!)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/30"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><Bell size={15}/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{row.reward.reason || row.reward.sourceEvent || "Reward activity"}</span><span className="block text-[10px] text-muted-foreground">{when(row.at)} · {String(row.reward.validationStatus).replace(/_/g," ")}</span></span><span className="text-xs font-bold text-emerald-700">+{fmt(row.reward.amount)} GHC</span><ChevronRight size={14}/></button>
        const a = resolveGhcActivityAttribution(row.tx!)
        const open = () => a.target ? navigateGhcActivityTarget(a.target) : (window.dispatchEvent(new CustomEvent("ghc:open-wallet")), true)
        return <button key={row.key} type="button" onClick={open} className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/30"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><Wallet size={15}/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{a.label}</span><span className="block truncate text-[10px] text-muted-foreground">{row.tx!.reason || row.tx!.sourceEvent} · {when(row.at)}</span></span><span className={`text-xs font-bold ${row.tx!.amount >= 0 ? "text-emerald-700" : "text-foreground"}`}>{row.tx!.amount >= 0 ? "+" : ""}{fmt(row.tx!.amount)} GHC</span><ChevronRight size={14}/></button>
      })}
    </div>
  </section>
}
