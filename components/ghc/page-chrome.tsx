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
      className={`flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/95 px-2.5 py-1.5 backdrop-blur-md ${className}`}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={17} strokeWidth={2.25} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[14px] font-bold leading-tight tracking-tight text-foreground">{title}</h1>
        {subtitle ? (
          <p className="truncate text-[10px] leading-tight text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {trailing}
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={Boolean(refreshing)}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-60"
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
