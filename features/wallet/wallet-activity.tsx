"use client"

import type { ReactNode } from "react"
import { ChevronRight, Clock, TrendingUp, TrendingDown } from "lucide-react"
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
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-foreground transition active:scale-[0.98]"
    >
      {icon}
      {label}
      <ChevronRight size={12} className="text-muted-foreground" />
    </button>
  )
}

export function TxRow({ tx, onOpen }: { tx: GhcTransaction; onOpen?: () => void }) {
  const positive = tx.amount >= 0
  const isPending = tx.status === "pending"
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left transition hover:bg-muted/30 active:scale-[0.99]"
    >
      <div
        className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
          isPending
            ? "bg-amber-50 text-amber-700"
            : positive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
        }`}
      >
        {isPending ? (
          <Clock size={14} />
        ) : positive ? (
          <TrendingUp size={14} />
        ) : (
          <TrendingDown size={14} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {TX_LABELS[tx.kind] && !tx.reason
              ? TX_LABELS[tx.kind]
              : tx.reason || TX_LABELS[tx.kind] || tx.kind}
          </p>
          <span
            className={`inline-flex shrink-0 items-center gap-1 text-sm font-bold ${
              isPending
                ? "text-amber-700"
                : positive
                  ? "text-emerald-700"
                  : "text-rose-700"
            }`}
          >
            <GhcCoinIcon size={16} />
            {positive ? "+" : ""}
            {formatGhc(tx.amount)}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <StatusChip status={tx.status || (tx.kind === "pending" ? "pending" : "posted")} />
          <span className="text-[11px] text-muted-foreground">
            {TX_LABELS[tx.kind] || tx.kind}
            {tx.sourceEvent ? ` · ${tx.sourceEvent}` : ""}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/80">{formatWhen(tx.createdAt)}</p>
      </div>
    </button>
  )
}

export function StatusChip({ status }: { status: string }) {
  const s = (status || "posted").toLowerCase()
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    posted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    reversed: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    expired: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
    failed: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
    cancelled: "bg-stone-200 text-stone-600",
    canceled: "bg-stone-200 text-stone-600",
  }
  const cls = map[s] || "bg-muted text-muted-foreground"
  const label = statusLabel(s).text
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

export function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 bg-card px-4 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/80">
        <GhcCoinIcon size={28} />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
