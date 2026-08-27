"use client"

/**
 * Shared chrome for Feed · Find · Matches · Communities · Messages · Profile.
 * Keeps spacing, chips, and cards consistent across primary tabs.
 */

import type { ReactNode } from "react"

export function SegmentedPills({
  items,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  items: { id: string; label: string; icon?: ReactNode; hint?: string }[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  size?: "sm" | "md"
}) {
  const pad = size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs"
  return (
    <div
      className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide"
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const selected = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={item.hint}
            onClick={() => onChange(item.id)}
            className={`flex min-h-9 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all active:scale-[0.97] ${pad} ${
              selected
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/30"
                : "bg-muted/80 text-muted-foreground ring-1 ring-border/60 hover:bg-primary/10 hover:text-primary"
            }`}
          >
            {item.icon ? (
              <span className={selected ? "opacity-90" : "opacity-60"} aria-hidden>
                {item.icon}
              </span>
            ) : null}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function SoftPanel({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode
  className?: string
  as?: "section" | "div" | "article"
}) {
  return (
    <Tag
      className={`rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm shadow-black/[0.03] dark:shadow-none ${className}`}
    >
      {children}
    </Tag>
  )
}

export function PageIntro({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CountBadge({ n, label }: { n: number; label?: string }) {
  if (!n) return null
  return (
    <span
      className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground"
      aria-label={label || `${n} new`}
    >
      {n > 99 ? "99+" : n}
    </span>
  )
}
