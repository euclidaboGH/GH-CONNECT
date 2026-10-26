"use client"

/**
 * Wallet primary actions — Send / Request / Receive / History.
 * `embedded` places the row under the balance hero without a second outer card.
 */

import { ArrowUpRight, ArrowDownLeft, HandCoins, Clock3 } from "lucide-react"

export function WalletPrimaryActions({
  onSend,
  onRequest,
  onReceive,
  onActivity,
  onAdd,
  disabled = false,
  embedded = false,
}: {
  onSend: () => void
  onRequest: () => void
  onReceive: () => void
  onActivity?: () => void
  onAdd?: () => void
  disabled?: boolean
  embedded?: boolean
}) {
  const items = [
    {
      id: "send",
      label: "Send",
      icon: <ArrowUpRight size={18} strokeWidth={2.25} />,
      onClick: onSend,
      tile: embedded
        ? "bg-white/20 text-white"
        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    },
    {
      id: "request",
      label: "Request",
      icon: <HandCoins size={18} strokeWidth={2.25} />,
      onClick: onRequest,
      tile: embedded
        ? "bg-white/20 text-white"
        : "bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    },
    {
      id: "receive",
      label: "Receive",
      icon: <ArrowDownLeft size={18} strokeWidth={2.25} />,
      onClick: onReceive,
      tile: embedded
        ? "bg-white/20 text-white"
        : "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    },
    {
      id: "activity",
      label: "History",
      icon: <Clock3 size={18} strokeWidth={2.25} />,
      onClick: onActivity || onAdd || (() => {}),
      tile: embedded ? "bg-white/15 text-white" : "bg-muted text-foreground dark:bg-muted/80",
    },
  ] as const

  const grid = (
    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Wallet actions">
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          disabled={disabled}
          className={
            embedded
              ? "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/10 px-1 py-2 text-center transition active:scale-[0.97] hover:bg-white/15 disabled:pointer-events-none disabled:opacity-50"
              : "flex min-h-[4.75rem] flex-col items-center justify-center gap-2 rounded-2xl bg-muted/40 px-1 py-2.5 text-center transition hover:bg-muted/70 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          }
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${a.tile}`}>
            {a.icon}
          </span>
          <span
            className={
              embedded
                ? "text-[11px] font-bold tracking-wide text-white"
                : "text-[11px] font-bold tracking-wide text-foreground"
            }
          >
            {a.label}
          </span>
        </button>
      ))}
    </div>
  )

  if (embedded) return grid

  return (
    <div className="mx-3 mt-3" role="group" aria-label="Wallet actions">
      <div className="rounded-[1.25rem] border border-border/50 bg-card p-3 shadow-[var(--gh-card-shadow)]">
        {grid}
      </div>
    </div>
  )
}
