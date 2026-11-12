"use client"

import { ArrowRight, CheckCircle2, CircleAlert, Target } from "lucide-react"
import type { HomeNextAction } from "@/lib/domains/adapters/home-next-action"
import { SectionHeading } from "@/components/ghc/section-heading"

export function HomeActionCentre({
  action,
  onAction,
}: {
  action: HomeNextAction
  onAction: () => void
}) {
  const needsAction = action.urgency !== "low"
  return (
    <section aria-label="What matters now" className="space-y-2">
      <SectionHeading
        eyebrow="Now"
        title="What matters now"
        description="One useful next move, based on your current GreenHaven activity."
      />
      <button
        type="button"
        onClick={onAction}
        className="group flex w-full min-h-[5.75rem] items-center gap-3 rounded-[var(--gh-product-radius)] border border-border/60 bg-card px-3.5 py-3 text-left shadow-[var(--gh-card-shadow)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]"
        aria-label={`${action.title}. ${action.cta}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${needsAction ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
          {needsAction ? <Target size={19} aria-hidden /> : <CheckCircle2 size={19} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-bold tracking-tight text-foreground">{action.title}</span>
            {action.urgency === "high" ? <CircleAlert size={13} className="shrink-0 text-amber-600" aria-hidden /> : null}
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{action.body}</span>
          <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
            {action.cta}
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </span>
      </button>
    </section>
  )
}
