"use client"

import { ArrowRight, Compass, MessageCircle, Plus, ShieldCheck, Users } from "lucide-react"
import type { HomeFocus } from "@/lib/home-personalization"
import { SectionHeading } from "@/components/ghc/section-heading"

const icons = {
  messages: MessageCircle,
  communities: Users,
  discovery: Compass,
  profile: ShieldCheck,
  create: Plus,
} as const

export function HomePersonalizedFocus({
  primary,
  secondary,
  onOpen,
}: {
  primary: HomeFocus | null
  secondary: HomeFocus[]
  onOpen: (focus: HomeFocus) => void
}) {
  if (!primary) return null
  const PrimaryIcon = icons[primary.kind]

  return (
    <section aria-label="Personalized focus" className="space-y-2">
      <SectionHeading
        eyebrow="Personalized focus"
        title="Use your home with purpose"
        description="These suggestions are based on activity already visible to you. Nothing here is invented or presented as a guaranteed outcome."
      />

      <div className="rounded-[var(--gh-product-radius)] border border-border/60 bg-card p-3.5 shadow-[var(--gh-card-shadow)]">
        <button
          type="button"
          onClick={() => onOpen(primary)}
          className="group flex w-full items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.045] p-3 text-left transition hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`${primary.title}. ${primary.cta}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PrimaryIcon size={19} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold tracking-tight text-foreground">{primary.title}</span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{primary.detail}</span>
            <span className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary">
              {primary.cta}<ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </span>
        </button>

        <p className="mt-2 px-1 text-[10px] leading-snug text-muted-foreground">
          Why this is here: {primary.reason}
        </p>

        {secondary.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Other relevant options">
            {secondary.map((focus) => {
              const Icon = icons[focus.kind]
              return (
                <button
                  key={`${focus.kind}-${focus.title}`}
                  type="button"
                  onClick={() => onOpen(focus)}
                  className="flex min-h-16 items-center gap-2.5 rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={`${focus.title}. ${focus.cta}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                    <Icon size={15} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-1 text-[11px] font-bold text-foreground">{focus.title}</span>
                    <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-muted-foreground">{focus.detail}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}
