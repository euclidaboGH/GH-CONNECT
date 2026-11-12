"use client"

import { ArrowRight, Check, CheckCircle2, CircleAlert, Compass, MessageCircle, ShieldCheck, Sparkles } from "lucide-react"
import type { HomeNextAction } from "@/lib/domains/adapters/home-next-action"
import type { JourneyStep } from "@/lib/home-journey"
import { SectionHeading } from "@/components/ghc/section-heading"
import { navigateTo } from "@/lib/navigation/navigate"

const icons = { profile: ShieldCheck, discover: Compass, connect: MessageCircle, participate: Sparkles }

function open(target: string) {
  if (!navigateTo(target)) {
    try { window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: target })) } catch { /* */ }
  }
}

export function HomeOutcomePanel({
  action,
  journey,
  onAction,
}: {
  action: HomeNextAction
  journey: { steps: JourneyStep[]; completed: number; total: number; percent: number; next: JourneyStep | null }
  onAction: () => void
}) {
  const needsAction = action.urgency !== "low"

  return (
    <section aria-label="Your next outcome" className="space-y-2">
      <SectionHeading
        eyebrow="Your next outcome"
        title="Move one thing forward"
        description="GreenHaven keeps the next useful step clear without turning your home into a checklist."
      />

      <div className="overflow-hidden rounded-[var(--gh-product-radius)] border border-border/60 bg-card shadow-[var(--gh-card-shadow)]">
        <button
          type="button"
          onClick={onAction}
          className="group flex min-h-[5.9rem] w-full items-center gap-3 border-b border-border/50 px-3.5 py-3 text-left transition hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.995]"
          aria-label={`${action.title}. ${action.cta}`}
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${needsAction ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
            {needsAction ? <CircleAlert size={19} aria-hidden /> : <CheckCircle2 size={19} aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-bold tracking-tight text-foreground">{action.title}</span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{action.body}</span>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
              {action.cta}<ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </span>
        </button>

        <div className="px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your foundation</p>
              <p className="mt-0.5 text-[11px] font-semibold text-foreground">{journey.completed} of {journey.total} complete</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-foreground">{journey.percent}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={journey.percent} aria-label={`GreenHaven foundation progress ${journey.percent}%`}>
            <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${journey.percent}%` }} />
          </div>

          <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="GreenHaven journey foundations">
            {journey.steps.map((step) => {
              const Icon = icons[step.id]
              const active = journey.next?.id === step.id
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={step.done}
                    onClick={() => !step.done && open(step.target)}
                    className={`flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${step.done ? "border-emerald-600/15 bg-emerald-600/[0.06]" : active ? "border-primary/30 bg-primary/[0.06]" : "border-border/40 bg-muted/20 hover:bg-muted/40"}`}
                    aria-label={`${step.title}${step.done ? ", complete" : ", open"}`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${step.done ? "bg-emerald-600 text-white" : active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {step.done ? <Check size={13} aria-hidden /> : <Icon size={13} aria-hidden />}
                    </span>
                    <span className="line-clamp-1 text-[9px] font-bold text-foreground">
                      {step.id === "profile" ? "Identity" : step.id === "discover" ? "Discover" : step.id === "connect" ? "Connect" : "Participate"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
