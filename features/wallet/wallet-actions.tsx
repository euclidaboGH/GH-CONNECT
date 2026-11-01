"use client"

/**
 * Phase 2 — shared wallet actions with clear PI vs GHC parity.
 * Send / Request / Receive / History adapt labels per selected rail.
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
  const items = [
    {
      id: "send",
      label: isPi ? "Withdraw" : "Send",
      hint: isPi ? "To Pi wallet" : "Transfer GHC",
      icon: <ArrowUpRight size={20} strokeWidth={2.25} />,
      onClick: onSend,
      accent: isPi
        ? "bg-violet-600 text-white shadow-sm shadow-violet-600/25"
        : "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25",
    },
    {
      id: "request",
      label: isPi ? "Status" : "Request",
      hint: isPi ? "Eligibility" : "Ask for GHC",
      icon: <HandCoins size={20} strokeWidth={2.25} />,
      onClick: onRequest,
      accent: isPi
        ? "bg-violet-100 text-violet-900 dark:bg-violet-950/55 dark:text-violet-100"
        : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-100",
    },
    {
      id: "receive",
      label: isPi ? "Linked" : "Receive",
      hint: isPi ? "Pi identity" : "Your QR / ID",
      icon: <ArrowDownLeft size={20} strokeWidth={2.25} />,
      onClick: onReceive,
      accent: isPi
        ? "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
        : "bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-100",
    },
    {
      id: "activity",
      label: "History",
      hint: isPi ? "PI ledger" : "GHC ledger",
      icon: <Clock3 size={20} strokeWidth={2.25} />,
      onClick: onActivity || onAdd || (() => {}),
      accent: "bg-muted text-foreground",
    },
  ] as const

  return (
    <div className="space-y-2" role="group" aria-label={isPi ? "PI wallet actions" : "GHC wallet actions"}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {isPi ? "PI actions" : "GHC actions"}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isPi ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          }`}
        >
          {isPi ? "π selected" : "₲ selected"}
        </span>
      </div>
      <div
        className={
          embedded
            ? "grid grid-cols-4 gap-1.5"
            : "grid grid-cols-4 gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[var(--gh-card-shadow)]"
        }
      >
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={a.onClick}
            className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition active:scale-[0.97] disabled:opacity-50 ${a.accent}`}
            aria-label={`${a.label}: ${a.hint}`}
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
