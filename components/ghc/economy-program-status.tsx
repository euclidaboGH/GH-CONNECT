"use client"

import { useMemo } from "react"
import { Info, Shield } from "lucide-react"
import {
  formatProgramBadge,
  getEconomyProgramStatus,
} from "@/lib/economy/program-status"

/**
 * Fail-closed economy program board.
 * Does not call settlement APIs or invent balances.
 */
export function EconomyProgramStatus({ compact = false }: { compact?: boolean }) {
  const rows = useMemo(() => getEconomyProgramStatus(), [])

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-border/60 bg-card/80 p-3"
          : "rounded-[1.35rem] border border-border/70 bg-card p-4 shadow-[var(--gh-card-shadow)]"
      }
      aria-label="GHC program status"
    >
      <div className="mb-3 flex items-start gap-2">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">GHC program status</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Issuance and redistribution stay server-gated. This board only shows configuration — not live balances.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => {
          const badge = formatProgramBadge(row)
          const on =
            row.mode === "spend" || row.mode === "utility"
              ? false
              : row.issuanceEnabled
          return (
            <li
              key={row.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{row.title}</p>
                {!compact ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{row.summary}</p>
                ) : null}
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                  (row.mode === "spend" || row.mode === "utility"
                    ? "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                    : on
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                      : "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100")
                }
              >
                {badge}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Referral and curation settlement default OFF until operator enables flags after Testnet evidence.
      </p>
    </section>
  )
}
