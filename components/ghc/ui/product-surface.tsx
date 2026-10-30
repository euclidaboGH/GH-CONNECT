"use client"

/**
 * Shared product chrome for Home, Profile, Wallet, Rewards, Membership, Marketplace.
 * Visual hierarchy only — no financial authority.
 */
import type { ReactNode } from "react"

export function SurfaceIntro({
  kicker,
  title,
  body,
  action,
  tone = "default",
}: {
  kicker?: string
  title: string
  body?: string
  action?: ReactNode
  tone?: "default" | "emerald" | "violet" | "amber"
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-card dark:border-emerald-900 dark:from-emerald-950/40"
      : tone === "violet"
        ? "border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-card dark:border-violet-900 dark:from-violet-950/40"
        : tone === "amber"
          ? "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-card dark:border-amber-900 dark:from-amber-950/40"
          : "border-border/70 bg-card"

  return (
    <div className={`mx-3 mt-3 rounded-2xl border p-3.5 shadow-[var(--gh-card-shadow)] ${toneCls}`}>
      {kicker ? (
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kicker}</p>
      ) : null}
      <p className="mt-0.5 text-sm font-bold text-foreground">{title}</p>
      {body ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-2.5 flex flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}

export function EconomyActionStrip({
  items,
}: {
  items: Array<{
    id: string
    label: string
    hint: string
    onClick: () => void
    accent?: "emerald" | "violet" | "amber" | "slate"
  }>
}) {
  const accentMap = {
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    violet: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
    slate: "bg-muted text-foreground",
  } as const

  return (
    <div
      className="mx-3 mt-3 grid grid-cols-3 gap-2"
      role="group"
      aria-label="Account economy"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl border border-border/70 bg-card px-1.5 py-2 text-center shadow-sm transition hover:border-emerald-300/70 active:scale-[0.98]"
        >
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black ${accentMap[item.accent || "slate"]}`}
          >
            {item.label.slice(0, 1)}
          </span>
          <span className="text-[11px] font-bold text-foreground">{item.label}</span>
          <span className="max-w-full truncate text-[9px] text-muted-foreground">{item.hint}</span>
        </button>
      ))}
    </div>
  )
}
