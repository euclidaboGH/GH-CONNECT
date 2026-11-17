"use client"

import { ArrowRight, CircleDollarSign, Clock3, Gift, History, Sparkles } from "lucide-react"
import { resolveEconomyNextAction } from "@/lib/economy-next-action"

export function EconomyOutcomeCentre({
  availableGhc,
  pendingGhc,
  lockedGhc,
  claimableToday,
  selectedRail,
  onOpenPending,
  onOpenRewards,
  onOpenActivity,
  onOpenPi,
}: {
  availableGhc: number
  pendingGhc: number
  lockedGhc: number
  claimableToday: boolean
  selectedRail: "ghc" | "pi"
  onOpenPending: () => void
  onOpenRewards: () => void
  onOpenActivity: () => void
  onOpenPi: () => void
}) {
  const next = resolveEconomyNextAction({ availableGhc, pendingGhc, lockedGhc, claimableToday, selectedRail })
  const run = () => {
    if (next.id === "pending") return onOpenPending()
    if (next.id === "claim" || next.id === "rewards") return onOpenRewards()
    if (next.id === "pi") return onOpenPi()
    return onOpenActivity()
  }
  const Icon = next.id === "pending" ? Clock3 : next.id === "claim" || next.id === "rewards" ? Gift : next.id === "pi" ? CircleDollarSign : History

  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-[1.4rem] border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-card to-card shadow-[var(--gh-card-shadow)] dark:border-emerald-900/70 dark:from-emerald-950/35" aria-label="Economic next step">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm"><Icon size={18} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-800 dark:text-emerald-300"><Sparkles size={12} aria-hidden /> What matters now</p>
            <h2 className="mt-1 text-[15px] font-black tracking-tight text-foreground">{next.title}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{next.detail}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Wallet results">
          <Metric label="Available" value={availableGhc} />
          <Metric label="Pending" value={pendingGhc} />
          <Metric label="Reserved" value={lockedGhc} />
        </div>
        <button type="button" onClick={run} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.99]">
          {next.cta}<ArrowRight size={15} aria-hidden />
        </button>
        <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{next.kicker} · GHC and Pi remain separate rails</p>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  const safe = Number.isFinite(value) ? value : 0
  return <div className="rounded-2xl border border-border/60 bg-card/80 px-2.5 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-[12px] font-black tabular-nums text-foreground">₲ {safe.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
}
