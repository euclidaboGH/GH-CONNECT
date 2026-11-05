"use client"

import type React from "react"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, CircleAlert, Loader2, WifiOff } from "lucide-react"
import { EXPERIENCE_COPY, type ExperienceStateKind } from "@/lib/experience-quality"

const ICONS: Record<ExperienceStateKind, LucideIcon> = {
  loading: Loader2,
  empty: CircleAlert,
  error: CircleAlert,
  success: CheckCircle2,
  offline: WifiOff,
}

export function ExperienceState({
  kind,
  title,
  description,
  action,
  className = "",
}: {
  kind: ExperienceStateKind
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}) {
  const Icon = ICONS[kind]
  const copy = EXPERIENCE_COPY[kind]
  const live = kind === "loading" || kind === "error" || kind === "offline"

  return (
    <div
      className={`rounded-[var(--gh-radius-lg)] border border-border/60 bg-card/80 px-5 py-8 text-center shadow-sm ${className}`}
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-primary">
        <Icon className={kind === "loading" ? "h-5 w-5 animate-spin motion-reduce:animate-none" : "h-5 w-5"} aria-hidden />
      </div>
      <h3 className="mt-3 text-sm font-bold tracking-tight text-foreground">{title || copy.title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">{description || copy.description}</p>
      {action ? (
        <button type="button" onClick={action.onClick} className="gh-btn gh-btn-secondary mt-4 min-h-10 px-4">
          {action.label}
        </button>
      ) : null}
    </div>
  )
}

export function LoadingState({ title = "Loading", description, className }: Omit<React.ComponentProps<typeof ExperienceState>, "kind">) {
  return <ExperienceState kind="loading" title={title} description={description} className={className} />
}

export function ErrorState({ title = "We couldn't load this", description, action, className }: Omit<React.ComponentProps<typeof ExperienceState>, "kind">) {
  return <ExperienceState kind="error" title={title} description={description} action={action} className={className} />
}
