"use client"

import { ArrowUpRight, ArrowDownLeft, HandCoins, ListOrdered } from "lucide-react"

export function WalletPrimaryActions({
  onSend,
  onRequest,
  onReceive,
  onActivity,
  onAdd,
  disabled = false,
}: {
  onSend: () => void
  onRequest: () => void
  onReceive: () => void
  /** Primary fourth action — Activity (fintech pattern) */
  onActivity?: () => void
  onAdd?: () => void
  /** Presentation-only lock while a parent flow is busy */
  disabled?: boolean
}) {
  const items = [
    {
      id: "send",
      label: "Send",
      icon: <ArrowUpRight size={20} strokeWidth={2.25} />,
      onClick: onSend,
      tile: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50",
    },
    {
      id: "request",
      label: "Request",
      icon: <HandCoins size={20} strokeWidth={2.25} />,
      onClick: onRequest,
      tile: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900/50",
    },
    {
      id: "receive",
      label: "Receive",
      icon: <ArrowDownLeft size={20} strokeWidth={2.25} />,
      onClick: onReceive,
      tile: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/50",
    },
    {
      id: "activity",
      label: "History",
      icon: <ListOrdered size={20} strokeWidth={2.25} />,
      onClick: onActivity || onAdd || (() => {}),
      tile: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/50",
    },
  ] as const

  return (
    <div className="mx-3 mt-4" role="group" aria-label="Wallet actions">
      <div className="grid grid-cols-4 gap-2.5">
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={a.onClick}
            disabled={disabled}
            className="flex min-h-[5.25rem] flex-col items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card px-1 py-3 text-center shadow-[var(--gh-card-shadow)] transition hover:border-border hover:shadow-md active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${a.tile}`}
            >
              {a.icon}
            </span>
            <span className="text-[11px] font-bold tracking-wide text-foreground">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
