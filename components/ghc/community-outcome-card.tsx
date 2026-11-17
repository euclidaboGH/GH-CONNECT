"use client"

import { ArrowRight, BarChart3, Calendar, CheckCircle2, MessageCircle, Sparkles, Users } from "lucide-react"
import type { CommunityOutcome } from "@/lib/domains/adapters/community-outcome"

const icons = {
  attention: CheckCircle2,
  poll: BarChart3,
  event: Calendar,
  challenge: Sparkles,
  chat: MessageCircle,
  explore: Users,
} as const

export function CommunityOutcomeCard({ outcome, onAction }: { outcome: CommunityOutcome; onAction: () => void }) {
  const Icon = icons[outcome.kind]
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm" aria-labelledby="community-outcome-title">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">What matters now</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">{outcome.priority}</span>
          </div>
          <h2 id="community-outcome-title" className="mt-0.5 text-[13px] font-bold text-foreground">{outcome.title}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{outcome.detail}</p>
          <button type="button" onClick={onAction} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            {outcome.actionLabel}<ArrowRight size={13} aria-hidden />
          </button>
        </div>
      </div>
    </section>
  )
}
