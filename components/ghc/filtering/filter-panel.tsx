"use client"

import { useId, useState, type ReactNode } from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

/**
 * Shared responsive filter workspace for Active GreenHaven modules.
 * Every viewport starts with a compact filter summary. The user explicitly
 * opens the facet tray; primary search controls can remain visible separately.
 */
export function FilterPanel({
  title,
  description,
  resultCount,
  activeCount = 0,
  defaultExpanded = false,
  className = "",
  persistentContent,
  children,
}: {
  title: string
  description?: string
  resultCount?: number
  activeCount?: number
  defaultExpanded?: boolean
  className?: string
  /** Search or other primary control that must remain available while facets are collapsed. */
  persistentContent?: ReactNode
  children: ReactNode
}) {
  const contentId = useId()
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section className={`min-w-0 rounded-2xl border border-border/70 bg-card/90 p-2.5 shadow-sm sm:p-3 ${className}`} aria-label={title}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SlidersHorizontal size={15} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xs font-extrabold text-foreground">{title}</h2>
            {description ? <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {typeof resultCount === "number" ? <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold tabular-nums text-muted-foreground" aria-live="polite">{resultCount} results</span> : null}
          <button
            type="button"
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 text-[10px] font-bold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide filters" : activeCount > 0 ? `Filters · ${activeCount}` : "Show filters"}
            <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
      </div>
      {persistentContent ? <div className="mt-2.5 min-w-0">{persistentContent}</div> : null}
      <div id={contentId} hidden={!expanded} className={`min-w-0 space-y-3 ${expanded ? "mt-3" : "mt-0"}`} data-filter-panel-content="true" data-expanded={expanded ? "true" : "false"}>
        {children}
      </div>
    </section>
  )
}
