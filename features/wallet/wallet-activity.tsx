"use client"

import type { ReactNode } from "react"
import { ChevronRight, Clock, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import type { GhcTransaction } from "@/lib/domains/economy-types"
import { TX_LABELS } from "./wallet-types"
import { formatGhc, formatWhen, statusLabel } from "./wallet-format"

export function QuickChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-[11px] font-bold text-foreground shadow-sm transition hover:bg-muted/60 active:scale-[0.98]"
    >
      {icon}
      {label}
      <ChevronRight size={12} className="text-muted-foreground" aria-hidden />
    </button>
  )
}

export function TxRow({ tx, onOpen }: { tx: GhcTransaction; onOpen?: () => void }) {
  const positive = tx.amount >= 0
  const isPending = (tx.status || "").toLowerCase() === "pending" || tx.kind === "pending"
  const title =
    TX_LABELS[tx.kind] && !tx.reason
      ? TX_LABELS[tx.kind]
      : tx.reason || TX_LABELS[tx.kind] || tx.kind

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-border/50 bg-card px-3.5 py-3.5 text-left transition last:border-b-0 hover:bg-muted/30 active:bg-muted/40"
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          isPending
            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900/40"
            : positive
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/40"
              : "bg-stone-50 text-stone-600 ring-1 ring-stone-100 dark:bg-stone-800/60 dark:text-stone-200 dark:ring-stone-700/40"
        }`}
        aria-hidden
      >
        {isPending ? (
          <Clock size={18} strokeWidth={2.25} />
        ) : positive ? (
          <ArrowDownLeft size={18} strokeWidth={2.25} />
        ) : (
          <ArrowUpRight size={18} strokeWidth={2.25} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-[14px] font-semibold leading-snug text-foreground">{title}</p>
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 text-[14px] font-bold tabular-nums ${
              isPending
                ? "text-amber-700 dark:text-amber-300"
                : positive
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-foreground"
            }`}
          >
            {positive ? "+" : "−"}
            {formatGhc(Math.abs(tx.amount))}
            <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">GHC</span>
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusChip status={tx.status || (tx.kind === "pending" ? "pending" : "posted")} />
          <span className="text-[11px] text-muted-foreground">
            {formatWhen(tx.createdAt)}
            {tx.sourceEvent ? ` · ${tx.sourceEvent}` : ""}
          </span>
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground/40" aria-hidden />
    </button>
  )
}

export function StatusChip({ status }: { status: string }) {
  const s = (status || "posted").toLowerCase()
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900/40",
    posted: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/40",
    confirmed: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/40",
    completed: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/40",
    reversed: "bg-stone-100 text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-300",
    expired: "bg-stone-100 text-stone-600 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-400",
    failed: "bg-rose-50 text-rose-800 ring-1 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-200",
    cancelled: "bg-stone-100 text-stone-600 ring-1 ring-stone-200",
    canceled: "bg-stone-100 text-stone-600 ring-1 ring-stone-200",
  }
  const cls = map[s] || "bg-muted text-muted-foreground"
  const label = statusLabel(s).text
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

export function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-card px-5 py-14 text-center shadow-[var(--gh-card-shadow)]">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/40">
        <GhcCoinIcon size={32} />
      </div>
      <p className="text-[15px] font-bold text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  )
}
