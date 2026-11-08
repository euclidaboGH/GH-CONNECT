"use client"

/**
 * Shared wallet actions — clean, non-duplicated.
 * GHC: Send · Request · Receive · History
 * PI: Withdraw · History only (consent + PIN live inside the single withdraw sheet)
 */

import { ArrowUpRight, ArrowDownLeft, HandCoins, Clock3 } from "lucide-react"

const TONES = {
  violet: { solid: "bg-violet-600 text-white shadow-violet-600/30", chip: "bg-white/20 text-white", soft: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200" },
  emerald: { solid: "bg-emerald-600 text-white shadow-emerald-600/30", chip: "bg-white/20 text-white", soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200" },
  amber: { solid: "bg-amber-500 text-white shadow-amber-500/30", chip: "bg-white/20 text-white", soft: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" },
  teal: { solid: "bg-teal-600 text-white shadow-teal-600/30", chip: "bg-white/20 text-white", soft: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200" },
  slate: { solid: "bg-slate-700 text-white shadow-slate-700/30", chip: "bg-white/20 text-white", soft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
} as const
type Tone = keyof typeof TONES

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
          hint: "To your Pi wallet",
          icon: <ArrowUpRight size={20} strokeWidth={2.25} />,
          onClick: onSend,
          tone: "violet",
          primary: true,
        },
        {
          id: "activity",
          label: "History",
          hint: "Pi ledger",
          icon: <Clock3 size={20} strokeWidth={2.25} />,
          onClick: onActivity || onAdd || (() => {}),
          tone: "slate",
          primary: false,
        },
      ]
    : [
        {
          id: "send",
          label: "Send",
          hint: "Transfer",
          icon: <ArrowUpRight size={20} strokeWidth={2.25} />,
          onClick: onSend,
          tone: "emerald",
          primary: true,
        },
        {
          id: "request",
          label: "Request",
          hint: "Ask for GHC",
          icon: <HandCoins size={20} strokeWidth={2.25} />,
          onClick: onRequest,
          tone: "amber",
          primary: false,
        },
        {
          id: "receive",
          label: "Receive",
          hint: "Show my ID",
          icon: <ArrowDownLeft size={20} strokeWidth={2.25} />,
          onClick: onReceive,
          tone: "teal",
          primary: false,
        },
        {
          id: "activity",
          label: "History",
          hint: "All activity",
          icon: <Clock3 size={20} strokeWidth={2.25} />,
          onClick: onActivity || onAdd || (() => {}),
          tone: "slate",
          primary: false,
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
            : `grid gap-2 rounded-2xl border border-border/70 bg-card p-2.5 shadow-[var(--gh-card-shadow)] ${
                isPi ? "grid-cols-2" : "grid-cols-4"
              }`
        }
      >
        {items.map((a) => {
          const tone = TONES[(a as { tone: Tone }).tone]
          const primary = (a as { primary?: boolean }).primary === true
          // Pi rail: two wide horizontal buttons. GHC rail: four compact tiles.
          return isPi ? (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={a.onClick}
              className={`group flex min-h-[4.25rem] items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                primary ? `${tone.solid} shadow-lg` : `border border-border/70 bg-card ${tone.soft}`
              }`}
              aria-label={`${a.label}: ${a.hint}`}
              data-testid={a.id === "withdraw" ? "wallet-primary-withdraw" : undefined}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${primary ? tone.chip : "bg-white/70 dark:bg-white/10"}`}>
                {a.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-extrabold leading-tight">{a.label}</span>
                <span className="mt-0.5 block truncate text-[11px] font-medium opacity-80">{a.hint}</span>
              </span>
            </button>
          ) : (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={a.onClick}
              className="group flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2 transition active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`${a.label}: ${a.hint}`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full transition group-active:scale-95 ${
                  primary ? `${tone.solid} shadow-lg` : tone.soft
                }`}
              >
                {a.icon}
              </span>
              <span className="text-[12px] font-extrabold leading-none text-foreground">{a.label}</span>
              <span className="max-w-full truncate px-0.5 text-[10px] font-medium text-muted-foreground">{a.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
