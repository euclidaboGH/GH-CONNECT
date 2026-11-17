"use client"

import { ArrowRight, Check, Compass, MessageCircle, ShieldCheck, Sparkles, Users } from "lucide-react"
import type { JourneyStep } from "@/lib/home-journey"
import { navigateTo } from "@/lib/navigation/navigate"

function open(target: string) {
  if (!navigateTo(target)) {
    try { window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: target })) } catch { /* */ }
  }
}

const icons = { profile: ShieldCheck, discover: Compass, connect: MessageCircle, participate: Sparkles }

export function HomeJourneyCard({ journey }: { journey: { steps: JourneyStep[]; completed: number; total: number; percent: number; next: JourneyStep | null } }) {
  if (!journey.next && journey.completed === journey.total) return null
  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-emerald-600/15 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card shadow-[var(--gh-card-shadow)]" aria-label="Your GreenHaven journey">
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"><Sparkles size={19} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">Your journey</p>
                <h2 className="mt-0.5 text-[14px] font-bold tracking-tight text-foreground">Build a useful GreenHaven presence</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{journey.completed} of {journey.total} foundations complete · {journey.percent}%</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-600/10 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{journey.percent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={journey.percent} aria-label={`Journey progress ${journey.percent}%`}>
              <span className="block h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${journey.percent}%` }} />
            </div>
          </div>
        </div>

        <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Journey foundations">
          {journey.steps.map((step, index) => {
            const Icon = icons[step.id]
            const active = journey.next?.id === step.id
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => !step.done && open(step.target)}
                  disabled={step.done}
                  className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${step.done ? "border-emerald-600/15 bg-emerald-600/[0.06]" : active ? "border-emerald-600/30 bg-background/80 shadow-sm" : "border-border/40 bg-background/50 hover:bg-background/80"}` }
                  aria-label={`${index + 1}. ${step.title}${step.done ? ", complete" : ", open"}`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${step.done ? "bg-emerald-600 text-white" : active ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    {step.done ? <Check size={14} aria-hidden /> : <Icon size={14} aria-hidden />}
                  </span>
                  <span className="line-clamp-1 text-[9px] font-bold text-foreground">{step.title.replace("Complete your identity", "Identity").replace("Discover your interests", "Discover").replace("Build your circle", "Connect").replace("Take part", "Participate")}</span>
                </button>
              </li>
            )
          })}
        </ol>

        {journey.next ? (
          <button type="button" onClick={() => open(journey.next!.target)} className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-xl border border-border/50 bg-background/75 px-3 text-left transition hover:bg-background active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"><Users size={16} aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-bold text-foreground">Next: {journey.next.title}</span>
              <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-muted-foreground">{journey.next.description}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
          </button>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-background/70 px-3 py-2.5 text-[11px] font-medium text-foreground"><Check size={15} className="text-emerald-600" aria-hidden /> Strong foundation complete. Keep exploring at your own pace.</div>
        )}
      </div>
    </section>
  )
}
