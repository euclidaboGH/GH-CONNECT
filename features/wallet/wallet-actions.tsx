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
    },
    {
      id: "request",
      label: "Request",
      icon: <HandCoins size={20} strokeWidth={2.25} />,
      onClick: onRequest,
    },
    {
      id: "receive",
      label: "Receive",
      icon: <ArrowDownLeft size={20} strokeWidth={2.25} />,
      onClick: onReceive,
    },
    {
      id: "activity",
      label: "Activity",
      icon: <ListOrdered size={20} strokeWidth={2.25} />,
      onClick: onActivity || onAdd || (() => {}),
    },
  ] as const

  return (
    <div className="mx-3 mt-3" role="group" aria-label="Wallet actions">
      <p className="gh-type-meta mb-1.5 px-0.5 font-bold uppercase tracking-wide text-muted-foreground">
        Actions
      </p>
      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={a.onClick}
            disabled={disabled}
            className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-center transition hover:bg-muted/50 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
              {a.icon}
            </span>
            <span className="text-[11px] font-bold tracking-wide text-foreground">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
