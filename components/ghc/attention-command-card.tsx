"use client"
import { ArrowRight, Bell } from "lucide-react"
import type { AttentionSignal } from "@/lib/unified-attention"

export function AttentionCommandCard({ signal, onOpen }: { signal: AttentionSignal | null; onOpen: (signal: AttentionSignal) => void }) {
  if (!signal) return null
  return <section className="mx-3 mt-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm" aria-label="What matters now">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700"><Bell size={17}/></span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">What matters now</p>
        <p className="mt-0.5 text-sm font-bold text-foreground">{signal.label} needs your attention</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{signal.count} {signal.count === 1 ? "item" : "items"} · {signal.detail}</p>
      </div>
      <button type="button" onClick={() => onOpen(signal)} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-foreground px-3 py-2 text-[11px] font-bold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Review <ArrowRight size={13}/></button>
    </div>
  </section>
}
