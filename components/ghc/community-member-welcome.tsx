"use client"

/**
 * First-visit member welcome — checklist + recommended next steps.
 * Preference-only (local); does not invent users or posts.
 */

import { Check, Sparkles, Users, MessageSquare, Calendar } from "lucide-react"
import type { MemberWelcomeModel, OnboardingStepId } from "@/lib/domains/adapters/community-member-onboarding"

export interface CommunityMemberWelcomeProps {
  model: MemberWelcomeModel
  onDismiss: () => void
  onChecklistStep?: (step: OnboardingStepId) => void
  onOpenMembers?: () => void
  onOpenBoard?: () => void
  onOpenEvents?: () => void
}

const STEP_ICON: Record<OnboardingStepId, typeof Sparkles> = {
  read_welcome: Sparkles,
  review_rules: Check,
  meet_people: Users,
  first_post: MessageSquare,
  explore_events: Calendar,
}

export function CommunityMemberWelcome({
  model,
  onDismiss,
  onChecklistStep,
  onOpenMembers,
  onOpenBoard,
  onOpenEvents,
}: CommunityMemberWelcomeProps) {
  if (!model.showWelcome) return null

  const pct =
    model.totalCount > 0
      ? Math.round((model.completedCount / model.totalCount) * 100)
      : 0

  const runStep = (id: OnboardingStepId) => {
    onChecklistStep?.(id)
    if (id === "meet_people") onOpenMembers?.()
    if (id === "first_post") onOpenBoard?.()
    if (id === "explore_events") onOpenEvents?.()
    if (id === "read_welcome" || id === "review_rules") onChecklistStep?.(id)
  }

  return (
    <section
      className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/90 via-card to-card p-4 shadow-sm dark:from-emerald-950/30"
      aria-label="Welcome to community"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Welcome
          </p>
          <h2 className="text-sm font-bold text-foreground">
            You&apos;re in {model.communityName}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {model.welcomeMessage ||
              `Glad you joined. Take a minute to settle in — introduce yourself when ready.`}
          </p>
          {model.joinReasons.length > 0 ? (
            <p className="mt-1.5 text-[11px] text-emerald-800 dark:text-emerald-200">
              Your focus: {model.joinReasons.join(" · ")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted"
        >
          Dismiss
        </button>
      </div>

      {/* Progress */}
      <div className="mt-3" aria-label={`Onboarding progress ${pct}%`}>
        <div className="mb-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
          <span>Getting started</span>
          <span>
            {model.completedCount}/{model.totalCount}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {model.rules.length > 0 ? (
        <div className="mt-3 rounded-xl border border-border/80 bg-background/70 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Rules snapshot
          </p>
          <ul className="mt-1 space-y-1">
            {model.rules.slice(0, 3).map((r, i) => (
              <li key={i} className="text-[11px] leading-snug text-foreground">
                · {r}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
            onClick={() => runStep("review_rules")}
          >
            Mark rules reviewed
          </button>
        </div>
      ) : null}

      <ul className="mt-3 space-y-1.5" aria-label="Getting started checklist">
        {model.checklist.map((step) => {
          const Icon = STEP_ICON[step.id]
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={step.done}
                onClick={() => runStep(step.id)}
                className={`flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  step.done
                    ? "border-emerald-500/30 bg-emerald-50/50 opacity-80 dark:bg-emerald-950/20"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    step.done
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {step.done ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold text-foreground">{step.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{step.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
