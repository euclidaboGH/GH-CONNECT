"use client"

import { ArrowRight, CircleDollarSign, Gift, MessageCircle, Users, Compass, ShieldCheck, Plus, CheckCircle2 } from "lucide-react"
import type { HomeCrossFeatureSignal } from "@/lib/home-cross-feature"
import { SectionHeading } from "@/components/ghc/section-heading"
import { outcomeEvidenceLabel, prepareHomeOutcomeSignals } from "@/lib/home-outcome-quality"
import { WorkflowFeedback } from "@/components/ghc/workflow-feedback"
import { workflowFeedback } from "@/lib/workflow-experience"
import { groupHomePriorities } from "@/lib/home-priority-groups"

const icons = { messages: MessageCircle, communities: Users, discovery: Compass, profile: ShieldCheck, create: Plus, wallet: CircleDollarSign, rewards: Gift } as const

export function HomeCrossFeaturePath({ signals, onOpen }: { signals: HomeCrossFeatureSignal[]; onOpen: (signal: HomeCrossFeatureSignal) => void }) {
  const preparedSignals = prepareHomeOutcomeSignals(signals)
  if (!preparedSignals.length) return null
  const primary = preparedSignals[0]
  const PrimaryIcon = icons[primary.kind]
  const evidenceLabel = outcomeEvidenceLabel(primary.evidence)
  const priorityGroups = groupHomePriorities(preparedSignals.slice(1, 7))

  return (
    <section aria-label="Cross-feature path" className="space-y-2">
      <SectionHeading
        eyebrow="Your next useful step"
        title="Keep your GreenHaven journey moving"
        description="Home connects the parts of GreenHaven that already have something relevant for you. Suggestions use visible, current state only."
      />
      <div className="rounded-[var(--gh-product-radius)] border border-border/60 bg-card p-3.5 shadow-[var(--gh-card-shadow)]">
        <button type="button" onClick={() => onOpen(primary)} className="group flex w-full items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.045] p-3 text-left transition hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PrimaryIcon size={19} aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 flex items-center gap-1.5">
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-primary">Recommended</span>
              <span className="text-[9px] font-semibold text-muted-foreground">Best next step</span>
            </span>
            <span className="block text-[13px] font-bold tracking-tight text-foreground">{primary.title}</span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{primary.detail}</span>
            <span className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary">{primary.cta}<ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
          </span>
        </button>
        <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-muted/25 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-primary" aria-hidden /><span><span className="font-semibold text-foreground/80">{evidenceLabel}.</span> {primary.reason}</span></div>
        <WorkflowFeedback state={workflowFeedback("info", "This recommendation is ready to open.", "GreenHaven will show the destination using the latest available state.")} />
        {priorityGroups.length > 0 ? (
          <div className="mt-4 space-y-3" aria-label="Other personal priorities">
            {priorityGroups.map((group) => (
              <section key={group.id} className="space-y-1.5" aria-labelledby={`home-priority-${group.id}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 id={`home-priority-${group.id}`} className="text-[11px] font-bold text-foreground">{group.label}</h3>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{group.signals.length} {group.signals.length === 1 ? "next step" : "next steps"}</span>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground">{group.description}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.signals.slice(0, 2).map((signal) => {
                    const Icon = icons[signal.kind]
                    return <button key={`${signal.kind}-${signal.title}`} type="button" onClick={() => onOpen(signal)} aria-label={`${signal.cta}: ${signal.title}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-muted/15 px-2.5 py-2 text-left transition hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm"><Icon size={15} aria-hidden /></span>
                      <span className="min-w-0 flex-1"><span className="block line-clamp-1 text-[11px] font-bold text-foreground">{signal.title}</span><span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-muted-foreground">{signal.detail}</span></span>
                      <ArrowRight size={13} className="shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
