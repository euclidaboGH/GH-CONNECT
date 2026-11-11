"use client"

import { X, SlidersHorizontal } from "lucide-react"

export type ActiveFilterItem = {
  id: string
  label: string
  onRemove: () => void
}

/** Shared active-filter summary used by discovery, feed and marketplace surfaces. */
export function FilterSummary({
  items,
  onClearAll,
  clearLabel = "Clear all",
  ariaLabel = "Active filters",
  className = "",
}: {
  items: ActiveFilterItem[]
  onClearAll: () => void
  clearLabel?: string
  ariaLabel?: string
  className?: string
}) {
  if (!items.length) return null

  return (
    <section
      className={`flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 ${className}`}
      aria-label={ariaLabel}
      aria-live="polite"
    >
      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <SlidersHorizontal size={12} aria-hidden />
        Filters <span className="tabular-nums">{items.length}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/15 bg-primary/5 py-1 pl-2.5 pr-1.5 text-[10px] font-semibold text-foreground"
          >
            <span className="max-w-[15rem] truncate">{item.label}</span>
            <button
              type="button"
              onClick={item.onRemove}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label={`Remove filter: ${item.label}`}
            >
              <X size={11} aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onClearAll}
        className="shrink-0 rounded-md px-1.5 py-1 text-[10px] font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {clearLabel}
      </button>
    </section>
  )
}
