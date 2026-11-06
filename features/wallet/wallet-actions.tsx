"use client"

/**
 * Shared wallet actions — clean, non-duplicated.
 * GHC: Send · Request · Receive · History
 * PI: Withdraw · History only (consent + PIN live inside the single withdraw sheet)
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
  assetRail = "ghc",
}: {
  onSend: () => void
  onRequest: () => void
  onReceive: () => void
  onActivity?: () => void
  onAdd?: () => void
  disabled?: boolean
  embedded?: boolean
  assetRail?: "ghc" | "pi"
}) {
  const isPi = assetRail === "pi"

  const items = isPi
    ? [
        {
          id: "withdraw",
          label: "Withdraw",
          hint: "To Pi wallet",
          icon: <ArrowUpRight size={20} strokeWidth={2.25} />,
          onClick: onSend,
          accent: "bg-violet-600 text-white shadow-sm shadow-violet-600/25",
        },
        {
          id: "activity",
          label: "History",
          hint: "PI ledger",
          icon: <Clock3 size={20} strokeWidth={2.25} />,
          onClick: onActivity || onAdd || (() => {}),
          accent: "bg-muted text-foreground",
        },
      ]
    : [
        {
          id: "send",
          label: "Send",
          hint: "Transfer",
          icon: <ArrowUpRight size={20} strokeWidth={2.25} />,
          onClick: onSend,
          accent: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25",
        },
        {
          id: "request",
          label: "Request",
          hint: "Request",
          icon: <HandCoins size={20} strokeWidth={2.25} />,
          onClick: onRequest,
          accent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100",
        },
        {
          id: "receive",
          label: "Receive",
          hint: "Receive",
          icon: <ArrowDownLeft size={20} strokeWidth={2.25} />,
          onClick: onReceive,
          accent: "bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-100",
        },
        {
          id: "activity",
          label: "History",
          hint: "History",
          icon: <Clock3 size={20} strokeWidth={2.25} />,
          onClick: onActivity || onAdd || (() => {}),
          accent: "bg-muted text-foreground",
        },
      ]

  return (
    <div className="space-y-2" role="group" aria-label={isPi ? "PI wallet actions" : "GHC wallet actions"}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {embedded ? (isPi ? "Pi" : "GHC") : isPi ? "Pi actions" : "GHC actions"}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isPi
              ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          }`}
        >
          {isPi ? "π selected" : "₲ selected"}
        </span>
      </div>
      <div
        className={
          embedded
            ? `grid gap-1.5 ${isPi ? "grid-cols-2" : "grid-cols-4"}`
            : `grid gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[var(--gh-card-shadow)] ${
                isPi ? "grid-cols-2" : "grid-cols-4"
              }`
        }
      >
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={a.onClick}
            className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${a.accent}`}
            aria-label={`${a.label}: ${a.hint}`}
            data-testid={a.id === "withdraw" ? "wallet-primary-withdraw" : undefined}
          >
            {a.icon}
            <span className="text-[11px] font-bold leading-none">{a.label}</span>
            <span className="max-w-full truncate px-0.5 text-[9px] font-medium opacity-80">{a.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
