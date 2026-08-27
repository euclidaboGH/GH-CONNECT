"use client"

/**
 * Shared action controls — Like, Comment, Share, Save, Follow, Report, etc.
 * Consistent 44px targets, clear active states, accessible labels.
 */

import type { ReactNode, ButtonHTMLAttributes } from "react"
import { Loader2 } from "lucide-react"

type Tone = "default" | "primary" | "danger" | "rose" | "amber" | "muted"

const TONE: Record<Tone, { idle: string; active: string }> = {
  default: {
    idle: "text-muted-foreground hover:bg-muted hover:text-foreground",
    active: "bg-primary/10 text-primary",
  },
  primary: {
    idle: "text-primary hover:bg-primary/10",
    active: "bg-primary text-primary-foreground shadow-sm",
  },
  danger: {
    idle: "text-muted-foreground hover:bg-red-50 hover:text-red-600",
    active: "bg-red-50 text-red-600",
  },
  rose: {
    idle: "text-muted-foreground hover:bg-rose-50 hover:text-rose-600",
    active: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
  },
  amber: {
    idle: "text-muted-foreground hover:bg-amber-50 hover:text-amber-700",
    active: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  muted: {
    idle: "text-muted-foreground hover:bg-muted",
    active: "bg-muted text-foreground",
  },
}

export function ActionIconButton({
  label,
  count,
  icon,
  active = false,
  tone = "default",
  busy = false,
  compact = false,
  className = "",
  ...rest
}: {
  label: string
  count?: number | string
  icon: ReactNode
  active?: boolean
  tone?: Tone
  busy?: boolean
  compact?: boolean
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const tones = TONE[tone]
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={rest.disabled || busy}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl font-semibold transition active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 ${
        compact ? "min-w-11 px-2.5 text-[11px]" : "min-w-[4.25rem] px-3 text-[12px]"
      } ${active ? tones.active : tones.idle} ${className}`}
      {...rest}
    >
      {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : icon}
      {count !== undefined && count !== "" ? (
        <span className="tabular-nums">{count}</span>
      ) : null}
    </button>
  )
}

export function ActionPill({
  children,
  active = false,
  variant = "neutral",
  busy = false,
  className = "",
  ...rest
}: {
  children: ReactNode
  active?: boolean
  variant?: "neutral" | "follow" | "connect" | "match" | "danger"
  busy?: boolean
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<string, string> = {
    neutral: active
      ? "border-border bg-muted text-foreground"
      : "border-border bg-card text-foreground hover:bg-muted",
    follow: active
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-transparent bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700",
    connect: active
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : "border-transparent bg-teal-600 text-white shadow-sm hover:bg-teal-700",
    match: active
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-transparent bg-rose-500 text-white shadow-sm shadow-rose-500/20 hover:bg-rose-600",
    danger: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  }
  return (
    <button
      type="button"
      disabled={rest.disabled || busy}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[12px] font-bold transition active:scale-[0.97] disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

export function IconRoundButton({
  label,
  children,
  className = "",
  ...rest
}: {
  label: string
  children: ReactNode
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
