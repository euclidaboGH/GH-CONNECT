"use client"

import { ArrowRight, CheckCircle2, CircleAlert, Compass, MessageCircle, ShieldCheck, Users } from "lucide-react"
import type { HomeResultMetric } from "@/lib/home-results"
import { SectionHeading } from "@/components/ghc/section-heading"

const icons = {
  identity: ShieldCheck,
  network: Users,
  messages: MessageCircle,
  communities: Compass,
} as const

export function HomeResultsStrip({
  metrics,
  onOpen,
}: {
  metrics: HomeResultMetric[]
  onOpen: (id: HomeResultMetric["id"]) => void
}) {
  return (
    <section aria-label="Your results" className="space-y-2">
      <SectionHeading
        eyebrow="Progress"
        title="Your results"
        description="See what is moving forward and where one action can make the biggest difference."
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = icons[metric.id]
          const AttentionIcon = metric.state === "attention" ? CircleAlert : CheckCircle2
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() => onOpen(metric.id)}
              className="gh-result-card group min-h-[7rem] p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground">
                  <Icon size={16} aria-hidden />
                </span>
                <AttentionIcon size={14} className={metric.state === "attention" ? "text-amber-600" : "text-emerald-600"} aria-hidden />
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                  <p className="mt-0.5 truncate text-[17px] font-bold tracking-tight text-foreground">{metric.value}</p>
                </div>
                <ArrowRight size={14} className="mb-0.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
              </div>
              <p className="mt-0.5 line-clamp-1 text-[9px] leading-snug text-muted-foreground">{metric.detail}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
