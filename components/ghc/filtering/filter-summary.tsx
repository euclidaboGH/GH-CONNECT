"use client"

import { X, SlidersHorizontal } from "lucide-react"

export type ActiveFilterItem = {
  id: string
  label: string
  onRemove: () => void
}

/** Shared, accessible active-filter summary for all GreenHaven discovery surfaces. */
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
      className={`flex min-w-0 flex-col gap-2 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm sm:flex-row sm:items-center ${className}`}
      aria-label={ariaLabel}
      aria-live="polite"
      aria-relevant="additions removals text"
    >
      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SlidersHorizontal size={15} aria-hidden />
        </span>
        <span>Applied filters</span>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-2 py-1 text-[11px] font-bold tabular-nums text-foreground">
          {items.length}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.id}
            className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] py-1 pl-3 pr-1.5 text-xs font-medium text-foreground"
          >
            <span className="max-w-[15rem] truncate">{item.label}</span>
            <button
              type="button"
              onClick={item.onRemove}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Remove filter: ${item.label}`}
            >
              <X size={13} aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onClearAll}
        className="min-h-9 shrink-0 self-start rounded-lg px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto"
      >
        {clearLabel}
      </button>
    </section>
  )
}
