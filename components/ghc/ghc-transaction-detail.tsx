"use client"

/**
 * Phase D5 — human-readable GHC transaction detail from existing ledger rows.
 * Does not invent transactions; only presents GhcTransaction fields.
 */

import { ArrowLeft, Copy, X } from "lucide-react"
import { useState } from "react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import type { GhcTransaction } from "@/lib/domains/economy-types"
import { activityTitle, formatGhcAmount, formatGhcWhen } from "@/lib/domains/ghc-wallet-ux"

const KIND_LABELS: Record<string, string> = {
  earned: "Earned",
  spent: "Spent",
  purchased: "Purchased",
  pending: "Pending credit",
  reversed: "Reversed",
  expired: "Expired",
  adjusted: "Adjustment",
  transfer_out: "Sent",
  transfer_in: "Received",
  transfer_request: "Request (no balance change)",
}

const STATUS_HELP: Record<string, string> = {
  pending: "Not spendable until validated and posted.",
  posted: "Recorded on the ledger.",
  reversed: "This entry was reversed.",
  expired: "This pending amount expired.",
  failed: "This operation did not complete.",
}

function formatGhc(n: number) {
  if (!Number.isFinite(n)) return "0"
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatWhen(ts?: number) {
  if (!ts) return "—"
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

function metaString(meta: Record<string, unknown> | undefined, key: string): string | null {
  if (!meta) return null
  const v = meta[key]
  if (v == null) return null
  if (typeof v === "string" || typeof v === "number") return String(v)
  return null
}

export type GhcTransactionDetailProps = {
  tx: GhcTransaction | null
  open: boolean
  onClose: () => void
}

export function GhcTransactionDetail({ tx, open, onClose }: GhcTransactionDetailProps) {
  const [copied, setCopied] = useState(false)
  if (!open || !tx) return null

  const positive = tx.amount >= 0
  const kindLabel = KIND_LABELS[tx.kind] || tx.kind
  const counterparty =
    metaString(tx.metadata, "counterpartyName") ||
    metaString(tx.metadata, "counterpartyId") ||
    metaString(tx.metadata, "toUserId") ||
    metaString(tx.metadata, "fromUserId")
  const note =
    metaString(tx.metadata, "note") ||
    metaString(tx.metadata, "message")

  const copyRef = async () => {
    const text = tx.referenceId || tx.id
    try {
      await navigator.clipboard?.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[88] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Transaction details"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            onClick={onClose}
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Transaction</p>
            <p className="text-[11px] text-muted-foreground">{kindLabel}</p>
          </div>
          <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="rounded-2xl border border-border bg-muted/20 px-4 py-5 text-center">
            <div className="mx-auto mb-2 flex justify-center">
              <GhcCoinIcon size={28} />
            </div>
            <p
              className={`text-3xl font-semibold tabular-nums ${
                tx.status === "pending"
                  ? "text-amber-700"
                  : positive
                    ? "text-emerald-700"
                    : "text-rose-700"
              }`}
            >
              {positive ? "+" : ""}
              {formatGhc(tx.amount)} <span className="text-base font-bold text-muted-foreground">GHC</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {tx.reason || kindLabel}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {tx.status}
            </p>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-right font-semibold">{kindLabel}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-right font-semibold capitalize">{tx.status}</dd>
            </div>
            {STATUS_HELP[tx.status] && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">{STATUS_HELP[tx.status]}</p>
            )}
            {tx.kind === "transfer_request" && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Request records do not change available balance until the request is paid.
              </p>
            )}
            {counterparty && (
              <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">
                  {tx.kind === "transfer_out" ? "To" : tx.kind === "transfer_in" ? "From" : "Counterparty"}
                </dt>
                <dd className="text-right font-semibold">{counterparty}</dd>
              </div>
            )}
            {note && (
              <div className="border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Note</dt>
                <dd className="mt-0.5 font-medium">{note}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Source</dt>
              <dd className="text-right text-xs font-medium">{tx.sourceEvent || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-right text-xs">{formatWhen(tx.createdAt)}</dd>
            </div>
            {tx.postedAt && (
              <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Posted</dt>
                <dd className="text-right text-xs">{formatWhen(tx.postedAt)}</dd>
              </div>
            )}
            {tx.expiresAt && (
              <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Expires</dt>
                <dd className="text-right text-xs">{formatWhen(tx.expiresAt)}</dd>
              </div>
            )}
            <div className="border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="mt-0.5 break-all font-mono text-[11px]">
                {tx.referenceId || tx.id}
              </dd>
              <button
                type="button"
                onClick={() => void copyRef()}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"
              >
                <Copy size={12} />
                {copied ? "Copied" : "Copy reference"}
              </button>
            </div>
          </dl>

          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
            Balances are derived from the ledger. This detail view does not authorize credits or
            debits.
          </p>
        </div>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
