"use client"

/**
 * Phase D3 — Request GHC flow.
 * Creates PENDING requests only — never moves available balance.
 * Payment uses fulfillGhcRequest → authoritative send path.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Search,
  User,
  X,
  AlertCircle,
} from "lucide-react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { mapGhcUxError } from "@/lib/domains/ghc-wallet-ux"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { DEFAULT_ECONOMY_LIMITS, type EconomyLimits } from "@/lib/domains/economy-types"
import { mapTransferFailure } from "@/lib/domains/economy-transfer-contract"
import {
  parseGhcAmount,
  buildTransferReference,
} from "@/lib/domains/send-ghc-helpers"
import { collectSendRecipients, type SendRecipient } from "./send-ghc-flow"

type Step = "payer" | "amount" | "review" | "sending" | "reconciling" | "success" | "error"

function formatGhc(n: number) {
  if (!Number.isFinite(n)) return "0"
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatWhen(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

function mapReqError(raw?: string): { title: string; body: string } {
  const m = mapGhcUxError(raw)
  return { title: m.title, body: m.next ? `${m.body} ${m.next}` : m.body }
}

export type RequestGhcFlowProps = {
  open: boolean
  onClose: () => void
  onCompleted: () => void
  limits?: EconomyLimits
  currentUserId?: string
}

export function RequestGhcFlow({
  open,
  onClose,
  onCompleted,
  limits = DEFAULT_ECONOMY_LIMITS,
  currentUserId = "current-user",
}: RequestGhcFlowProps) {
  const [step, setStep] = useState<Step>("payer")
  const [query, setQuery] = useState("")
  const [payer, setPayer] = useState<SendRecipient | null>(null)
  const [manualId, setManualId] = useState("")
  const [amountRaw, setAmountRaw] = useState("")
  const [note, setNote] = useState("")
  const [errorTitle, setErrorTitle] = useState("")
  const [errorBody, setErrorBody] = useState("")
  const [receipt, setReceipt] = useState<{
    amount: number
    referenceId: string
    from: SendRecipient
    note?: string
    expiresAt?: number
    at: number
  } | null>(null)

  const referenceIdRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)
  const amountInputRef = useRef<HTMLInputElement>(null)

  const directory = useMemo(() => (open ? collectSendRecipients() : []), [open])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return directory.slice(0, 24)
    return directory
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.username || "").toLowerCase().includes(q)
      )
      .slice(0, 24)
  }, [directory, query])

  const amount = parseGhcAmount(amountRaw)
  const minA = limits.minimumTransferAmount ?? 1
  const maxA = limits.maximumTransferAmount ?? 5000
  const amountError = useMemo(() => {
    if (!amountRaw.trim()) return null
    if (amount == null) return "Enter a valid amount"
    if (amount < minA) return `Minimum is ${formatGhc(minA)} GHC`
    if (amount > maxA) return `Maximum is ${formatGhc(maxA)} GHC`
    return null
  }, [amountRaw, amount, minA, maxA])

  const expiryDays = Math.max(1, Math.round((limits.requestExpiryMs || 7 * 864e5) / 864e5))

  useEffect(() => {
    if (!open) {
      setStep("payer")
      setQuery("")
      setPayer(null)
      setManualId("")
      setAmountRaw("")
      setNote("")
      setErrorTitle("")
      setErrorBody("")
      setReceipt(null)
      referenceIdRef.current = null
      inFlightRef.current = false
    }
  }, [open])

  useEffect(() => {
    if (step === "amount") {
      window.setTimeout(() => amountInputRef.current?.focus(), 80)
    }
  }, [step])

  const selectPayer = (r: SendRecipient) => {
    if (r.id === currentUserId) {
      setErrorTitle("Invalid member")
      setErrorBody("You cannot request GHC from yourself.")
      setStep("error")
      return
    }
    setPayer(r)
    setStep("amount")
  }

  const useManual = () => {
    const id = manualId.trim()
    if (!id) return
    if (id === currentUserId) {
      setErrorTitle("Invalid member")
      setErrorBody("You cannot request GHC from yourself.")
      setStep("error")
      return
    }
    setPayer({ id, name: id, username: id })
    setStep("amount")
  }

  const goReview = () => {
    if (!payer || amount == null || amountError) return
    if (!referenceIdRef.current) {
      referenceIdRef.current = buildTransferReference(currentUserId, payer.id, amount).replace(
        /^p2p_/,
        "req_"
      )
    }
    setStep("review")
  }

  const reconcileRequest = async (ref: string, from: SendRecipient, amt: number, noteText?: string) => {
    setStep("reconciling")
    try {
      const eco = getBoundDomainServices()?.economy as {
        listOutgoingTransferRequests?: () => Array<{ referenceId: string; amount: number; expiresAt?: number }>
      } | null
      const list = eco?.listOutgoingTransferRequests?.() || []
      const found = list.find((r) => r.referenceId === ref)
      if (found) {
        setReceipt({
          amount: amt,
          referenceId: ref,
          from,
          note: noteText,
          expiresAt: found.expiresAt,
          at: Date.now(),
        })
        setStep("success")
        onCompleted()
        return
      }
    } catch {
      /* */
    }
    const m = mapReqError("NETWORK_TIMEOUT")
    setErrorTitle(m.title)
    setErrorBody(m.body)
    setStep("error")
  }

  const submitRequest = useCallback(async () => {
    if (inFlightRef.current) return
    if (!payer || amount == null) return
    const ref =
      referenceIdRef.current ||
      buildTransferReference(currentUserId, payer.id, amount).replace(/^p2p_/, "req_")
    referenceIdRef.current = ref
    inFlightRef.current = true
    setStep("sending")

    try {
      const eco = getBoundDomainServices()?.economy as {
        requestGhcFromUser?: (i: {
          fromUserId: string
          fromUserName: string
          amount: number
          note?: string
          referenceId?: string
        }) => Promise<{
          ok: boolean
          error?: string
          data?: { tx?: { referenceId?: string; metadata?: { expiresAt?: number } } }
        }>
      } | null

      if (!eco?.requestGhcFromUser) {
        const m = mapReqError("SERVER_UNAVAILABLE")
        setErrorTitle(m.title)
        setErrorBody(m.body)
        setStep("error")
        return
      }

      const res = await eco.requestGhcFromUser({
        fromUserId: payer.id,
        fromUserName: payer.name,
        amount,
        note: note.trim().slice(0, 120) || undefined,
        referenceId: ref,
      })

      if (!res.ok) {
        const err = res.error || ""
        if (/timeout|network/i.test(err)) {
          await reconcileRequest(ref, payer, amount, note.trim() || undefined)
          return
        }
        const m = mapReqError(err)
        setErrorTitle(m.title)
        setErrorBody(m.body)
        setStep("error")
        return
      }

      const expiresAt =
        (res.data?.tx?.metadata as { expiresAt?: number } | undefined)?.expiresAt ||
        Date.now() + (limits.requestExpiryMs || 7 * 864e5)

      setReceipt({
        amount,
        referenceId: res.data?.tx?.referenceId || ref,
        from: payer,
        note: note.trim() || undefined,
        expiresAt,
        at: Date.now(),
      })
      setStep("success")
      onCompleted()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "TRANSFER_FAILED"
      if (/timeout|network|fetch/i.test(msg)) {
        await reconcileRequest(ref, payer, amount, note.trim() || undefined)
        return
      }
      const m = mapReqError(msg)
      setErrorTitle(m.title)
      setErrorBody(m.body)
      setStep("error")
    } finally {
      inFlightRef.current = false
    }
  }, [payer, amount, note, currentUserId, onCompleted, limits.requestExpiryMs])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Request GHC"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          {step !== "success" && step !== "sending" && step !== "reconciling" && (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Back"
              onClick={() => {
                if (step === "payer") onClose()
                else if (step === "amount") setStep("payer")
                else if (step === "review") setStep("amount")
                else if (step === "error") setStep("review")
                else onClose()
              }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              {step === "payer" && "Request GHC"}
              {step === "amount" && "How much GHC?"}
              {step === "review" && "Review GHC request"}
              {step === "sending" && "Sending request…"}
              {step === "reconciling" && "Checking request status…"}
              {step === "success" && "Request sent"}
              {step === "error" && "Request issue"}
            </p>
            <p className="text-[11px] text-muted-foreground">No GHC moves until accepted</p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Close"
            onClick={onClose}
            disabled={step === "sending"}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {step === "payer" && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-muted-foreground" htmlFor="req-search">
                Request from
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="req-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or ID"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <ul className="space-y-1" role="listbox" aria-label="Members">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="option"
                      onClick={() => selectPayer(r)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted/50"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User size={18} className="text-muted-foreground" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{r.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {r.username || r.id}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="py-6 text-center text-xs text-muted-foreground">
                    No matches. Enter a GreenHaven ID below.
                  </li>
                )}
              </ul>
              <div className="border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="req-manual">
                  Or enter GreenHaven ID
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="req-manual"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="member-id"
                  />
                  <button
                    type="button"
                    onClick={useManual}
                    disabled={!manualId.trim()}
                    className="rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "amount" && payer && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User size={18} className="text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Requesting from
                  </p>
                  <p className="truncate text-sm font-bold">{payer.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{payer.id}</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="req-amount">
                  How much GHC?
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <GhcCoinIcon size={22} />
                  <input
                    ref={amountInputRef}
                    id="req-amount"
                    inputMode="decimal"
                    value={amountRaw}
                    onChange={(e) => setAmountRaw(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0.00"
                    className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums outline-none"
                    aria-invalid={!!amountError}
                  />
                  <span className="text-sm font-bold text-muted-foreground">GHC</span>
                </div>
                {amountError ? (
                  <p className="mt-1.5 text-xs font-medium text-rose-600" role="alert">
                    {amountError}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Creating a request does not spend your available GHC.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="req-note">
                  Reason for request <span className="font-normal">(optional)</span>
                </label>
                <input
                  id="req-note"
                  value={note}
                  maxLength={120}
                  onChange={(e) => setNote(e.target.value.slice(0, 120))}
                  placeholder="e.g. School contribution"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                disabled={amount == null || !!amountError}
                onClick={goReview}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Continue to review
              </button>
            </div>
          )}

          {step === "review" && payer && amount != null && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 px-4 py-5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Requesting
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  {formatGhc(amount)} <span className="text-base font-bold text-muted-foreground">GHC</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">From</p>
                <p className="mt-1 text-sm font-bold">{payer.name}</p>
                <p className="text-[11px] text-muted-foreground">{payer.id}</p>
              </div>
              {note.trim() && (
                <div>
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Reason</p>
                  <p className="mt-1 text-sm">{note.trim()}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Request expires in about {expiryDays} days.{" "}
                <span className="font-semibold text-foreground">
                  No GHC will be deducted until the request is accepted.
                </span>
              </p>
              <button
                type="button"
                onClick={() => void submitRequest()}
                className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white"
              >
                Send Request
              </button>
              <button
                type="button"
                onClick={() => setStep("amount")}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground"
              >
                Back
              </button>
            </div>
          )}

          {(step === "sending" || step === "reconciling") && (
            <div className="flex flex-col items-center py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
              <p className="mt-4 text-sm font-semibold">
                {step === "sending" ? "Sending request…" : "Checking request status…"}
              </p>
            </div>
          )}

          {step === "success" && receipt && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950">
                <CheckCircle2 size={28} />
              </div>
              <p className="text-sm font-bold">Request sent</p>
              <p className="text-2xl font-semibold tabular-nums">{formatGhc(receipt.amount)} GHC</p>
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-left text-sm">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Requested from</p>
                <p className="font-bold">{receipt.from.name}</p>
                <p className="text-[11px] text-muted-foreground">{receipt.from.id}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase text-muted-foreground">Status</p>
                <p className="font-semibold text-amber-700">Pending</p>
                {receipt.expiresAt && (
                  <>
                    <p className="mt-2 text-[11px] font-semibold uppercase text-muted-foreground">Expires</p>
                    <p>{formatWhen(receipt.expiresAt)}</p>
                  </>
                )}
                <p className="mt-2 text-[11px] font-semibold uppercase text-muted-foreground">Request ID</p>
                <p className="break-all font-mono text-xs">{receipt.referenceId}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  onCompleted()
                  onClose()
                }}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold"
              >
                View Requests
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertCircle size={28} />
              </div>
              <p className="text-sm font-bold">{errorTitle}</p>
              <p className="text-xs text-muted-foreground">{errorBody}</p>
              <button
                type="button"
                onClick={() => setStep("review")}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
              >
                Back to review
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
