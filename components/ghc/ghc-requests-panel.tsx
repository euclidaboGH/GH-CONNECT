"use client"

/**
 * Phase D3 — Incoming / outgoing GHC request inbox + pay / decline / cancel.
 */

import { useCallback, useMemo, useState } from "react"
import { ArrowLeft, Loader2, X } from "lucide-react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { EMPTY_STATES, isRequestPayable, mapGhcUxError, requestStatusLabel } from "@/lib/domains/ghc-wallet-ux"
import { getBoundDomainServices } from "@/lib/domains/compat"
import type { GhcTransferRequest } from "@/lib/domains/economy-types"

function formatGhc(n: number) {
  if (!Number.isFinite(n)) return "0"
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatWhen(ts?: number) {
  if (!ts) return "—"
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

type Props = {
  open: boolean
  onClose: () => void
  availableBalance: number
  onChanged: () => void
}

export function GhcRequestsPanel({ open, onClose, availableBalance, onChanged }: Props) {
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [payConfirm, setPayConfirm] = useState<GhcTransferRequest | null>(null)
  const [tick, setTick] = useState(0)

  const { incoming, outgoing } = useMemo(() => {
    void tick
    try {
      const eco = getBoundDomainServices()?.economy as {
        listIncomingTransferRequests?: () => GhcTransferRequest[]
        listOutgoingTransferRequests?: () => GhcTransferRequest[]
        expireStaleTransferRequests?: () => number
      } | null
      eco?.expireStaleTransferRequests?.()
      return {
        incoming: eco?.listIncomingTransferRequests?.() || [],
        outgoing: eco?.listOutgoingTransferRequests?.() || [],
      }
    } catch {
      return { incoming: [], outgoing: [] }
    }
  }, [tick, open])

  const refresh = () => {
    setTick((t) => t + 1)
    onChanged()
  }

  const decline = useCallback(
    async (ref: string) => {
      setBusyId(ref)
      setMsg(null)
      try {
        const eco = getBoundDomainServices()?.economy as {
          declineGhcRequest?: (i: { referenceId: string }) => Promise<{ ok: boolean; error?: string }>
        } | null
        const res = await eco?.declineGhcRequest?.({ referenceId: ref })
        if (!res?.ok) setMsg(res?.error || "Could not decline")
        else {
          setMsg("Request declined. No GHC was transferred.")
          refresh()
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not decline")
      } finally {
        setBusyId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const cancel = useCallback(async (ref: string) => {
    setBusyId(ref)
    setMsg(null)
    try {
      const eco = getBoundDomainServices()?.economy as {
        cancelGhcRequest?: (i: { referenceId: string }) => Promise<{ ok: boolean; error?: string }>
      } | null
      const res = await eco?.cancelGhcRequest?.({ referenceId: ref })
      if (!res?.ok) setMsg(res?.error || "Could not cancel")
      else {
        setMsg("Request cancelled. No GHC was transferred.")
        refresh()
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not cancel")
    } finally {
      setBusyId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pay = useCallback(
    async (req: GhcTransferRequest) => {
      setBusyId(req.referenceId)
      setMsg(null)
      try {
        const eco = getBoundDomainServices()?.economy as {
          fulfillGhcRequest?: (i: {
            requestReferenceId: string
            toUserId: string
            toUserName: string
            amount: number
            note?: string
          }) => Promise<{ ok: boolean; error?: string }>
          hydrate?: () => Promise<void>
        } | null
        if (!eco?.fulfillGhcRequest) {
          setMsg("Payment unavailable")
          return
        }
        const res = await eco.fulfillGhcRequest({
          requestReferenceId: req.referenceId,
          toUserId: req.requesterId,
          toUserName: req.counterpartyName || req.requesterId,
          amount: req.amount,
          note: req.note,
        })
        if (!res.ok) {
          setMsg(mapGhcUxError(res.error || "TRANSFER_FAILED").body + " Request remains pending if still open.")
          return
        }
        if (eco.hydrate) {
          try {
            await eco.hydrate()
          } catch {
            /* */
          }
        }
        setPayConfirm(null)
        setMsg("Payment completed. Request accepted.")
        refresh()
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Payment failed")
      } finally {
        setBusyId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  if (!open) return null

  const list = tab === "incoming" ? incoming : outgoing

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="GHC requests"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
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
            <p className="text-sm font-bold">Requests</p>
            <p className="text-[11px] text-muted-foreground">Pending GHC requests · no balance change until paid</p>
          </div>
          <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border p-2">
          {(
            [
              { id: "incoming" as const, label: `Incoming (${incoming.length})` },
              { id: "outgoing" as const, label: `Outgoing (${outgoing.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                tab === t.id ? "bg-emerald-600 text-white" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {msg && (
            <p className="mb-2 rounded-lg bg-muted px-3 py-2 text-xs text-foreground" role="status">
              {msg}
            </p>
          )}
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
              <GhcCoinIcon size={28} className="mx-auto opacity-80" />
              <p className="mt-2 text-sm font-semibold">
                {tab === "incoming"
                  ? EMPTY_STATES.incomingRequests.title
                  : EMPTY_STATES.outgoingRequests.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tab === "incoming"
                  ? EMPTY_STATES.incomingRequests.body
                  : EMPTY_STATES.outgoingRequests.body}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((r) => (
                <li key={r.referenceId} className="rounded-2xl border border-border bg-background px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {tab === "incoming"
                          ? r.counterpartyName || r.requesterId
                          : `To ${r.counterpartyName || r.payerId}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {tab === "incoming" ? r.requesterId : r.payerId}
                      </p>
                      {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {requestStatusLabel(r.status)} · expires {formatWhen(r.expiresAt)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums">
                      <GhcCoinIcon size={16} />
                      {formatGhc(r.amount)}
                    </span>
                  </div>
                  {isRequestPayable(r.status, r.expiresAt) && tab === "incoming" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === r.referenceId}
                        onClick={() => setPayConfirm(r)}
                        className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Pay {formatGhc(r.amount)} GHC
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.referenceId}
                        onClick={() => void decline(r.referenceId)}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {r.status === "PENDING" && tab === "outgoing" && (
                    <button
                      type="button"
                      disabled={busyId === r.referenceId}
                      onClick={() => void cancel(r.referenceId)}
                      className="mt-2 w-full rounded-xl border border-border py-2 text-xs font-semibold"
                    >
                      {busyId === r.referenceId ? "…" : "Cancel request"}
                    </button>
                  )}
                  {r.status !== "PENDING" && (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {r.status}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pay confirmation */}
      {payConfirm && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
            <p className="text-sm font-bold">Pay request</p>
            <p className="mt-3 text-center text-2xl font-semibold tabular-nums">
              {formatGhc(payConfirm.amount)} GHC
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              To {payConfirm.counterpartyName || payConfirm.requesterId}
            </p>
            {payConfirm.note && (
              <p className="mt-2 text-center text-xs text-muted-foreground">{payConfirm.note}</p>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Available <span className="font-semibold text-foreground">{formatGhc(availableBalance)} GHC</span>
            </p>
            <button
              type="button"
              disabled={busyId === payConfirm.referenceId}
              onClick={() => void pay(payConfirm)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busyId === payConfirm.referenceId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Pay &amp; Complete Request
            </button>
            <button
              type="button"
              onClick={() => setPayConfirm(null)}
              className="mt-2 w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Compact badge count for wallet chrome */
export function useGhcRequestCounts(): { incoming: number; outgoing: number } {
  try {
    const eco = getBoundDomainServices()?.economy as {
      listIncomingTransferRequests?: () => GhcTransferRequest[]
      listOutgoingTransferRequests?: () => GhcTransferRequest[]
      expireStaleTransferRequests?: () => void
    } | null
    eco?.expireStaleTransferRequests?.()
    return {
      incoming: (eco?.listIncomingTransferRequests?.() || []).filter((r) => r.status === "PENDING")
        .length,
      outgoing: (eco?.listOutgoingTransferRequests?.() || []).filter((r) => r.status === "PENDING")
        .length,
    }
  } catch {
    return { incoming: 0, outgoing: 0 }
  }
}
