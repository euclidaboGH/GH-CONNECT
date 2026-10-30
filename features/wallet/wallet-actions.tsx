"use client"

/**
 * Shared wallet actions — Send / Request / Receive / History.
 * Labels adapt when the selected asset rail is PI vs GHC.
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
      icon: <ArrowUpRight size={18} strokeWidth={2.25} />,
      onClick: onSend,
      accent: isPi
        ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    },
    {
      id: "request",
      label: isPi ? "Status" : "Request",
      hint: isPi ? "Eligibility" : "Ask for GHC",
      icon: <HandCoins size={18} strokeWidth={2.25} />,
      onClick: onRequest,
      accent: isPi
        ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
        : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    },
    {
      id: "receive",
      label: isPi ? "Linked" : "Receive",
      hint: isPi ? "Pi identity" : "Your QR / ID",
      icon: <ArrowDownLeft size={18} strokeWidth={2.25} />,
      onClick: onReceive,
      accent: isPi
        ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
        : "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
    },
    {
      id: "activity",
      label: "History",
      hint: isPi ? "PI ledger" : "GHC ledger",
      icon: <Clock3 size={18} strokeWidth={2.25} />,
      onClick: onActivity || onAdd || (() => {}),
      accent: "bg-muted text-foreground",
    },
  ] as const

  return (
    <div
      className={
        embedded
          ? "grid grid-cols-4 gap-1.5 px-1"
          : "mx-3 mt-3 grid grid-cols-4 gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[var(--gh-card-shadow)]"
      }
      role="group"
      aria-label={isPi ? "PI wallet actions" : "GHC wallet actions"}
    >
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          disabled={disabled}
          className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center transition hover:bg-black/[0.03] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-white/[0.04]"
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${a.accent}`}>{a.icon}</span>
          <span className="text-[11px] font-bold leading-tight text-foreground">{a.label}</span>
          <span className="max-w-[4.5rem] truncate text-[9px] font-medium text-muted-foreground">{a.hint}</span>
        </button>
      ))}
    </div>
  )
}
