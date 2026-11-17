"use client"

/**
 * Shared compact page chrome for secondary screens (wallet, rewards, membership,
 * marketplace subviews, communities). Keeps headers thin so content owns the viewport.
 */
import type { ReactNode } from "react"
import { ArrowLeft, RefreshCw } from "lucide-react"

export function PageChrome({
  title,
  subtitle,
  onBack,
  onRefresh,
  refreshing,
  trailing,
  className = "",
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  onRefresh?: () => void
  refreshing?: boolean
  trailing?: ReactNode
  className?: string
}) {
  return (
    <header
      className={`gh-page-chrome flex min-h-[3.75rem] shrink-0 items-center gap-3 border-b border-[var(--gh-ref-line)] px-4 py-3 ${className}`}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="gh-icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={17} strokeWidth={2.25} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-[17px]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 truncate text-xs leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {trailing}
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={Boolean(refreshing)}
          className="gh-secondary-control inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
          aria-busy={Boolean(refreshing)}
          aria-label={refreshing ? "Refreshing" : "Refresh"}
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} aria-hidden />
          {refreshing ? "…" : "Refresh"}
        </button>
      ) : null}
    </header>
  )
}
