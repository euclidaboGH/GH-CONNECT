"use client"

/**
 * Phase D2 — production-quality Send GHC flow.
 * Money moves only via economy.sendGhcToUser (domain → Phase B/C).
 * UI is never the security authority.
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

export { parseGhcAmount, buildTransferReference }

export type SendRecipient = {
  id: string
  name: string
  username?: string
  photo?: string | null
}

type Step = "recipient" | "amount" | "review" | "sending" | "reconciling" | "success" | "error"

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
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

export function collectSendRecipients(): SendRecipient[] {
  const out: SendRecipient[] = []
  const seen = new Set<string>()
  try {
    const services = getBoundDomainServices() as any
    const graph = services?.graph
    const snap = graph?.getSnapshot?.()
    const ids = [
      ...(snap?.followingIds || graph?.followingIds?.() || []),
      ...(snap?.friendIds || []),
      ...(graph?.getFriends?.() || []),
    ] as string[]
    for (const id of ids) {
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push({ id, name: id, username: id })
    }
  } catch {
    /* graph optional */
  }
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("ghc_discovery_candidates") : null
    if (raw) {
      const list = JSON.parse(raw) as Array<{ id?: string; name?: string; photo?: string }>
      for (const c of list) {
        if (!c?.id || seen.has(c.id)) continue
        seen.add(c.id)
        out.push({ id: c.id, name: c.name || c.id, photo: c.photo })
      }
    }
  } catch {
    /* */
  }
  return out
}

function mapUserError(raw?: string): { title: string; body: string } {
  const m = mapGhcUxError(raw)
  return { title: m.title, body: m.next ? `${m.body} ${m.next}` : m.body }
}

export type SendGhcFlowProps = {
  open: boolean
  onClose: () => void
  availableBalance: number
  onCompleted: () => void
  limits?: EconomyLimits
  currentUserId?: string
  /** Pre-selected recipient (e.g. from Receive QR / ID lookup) */
  initialRecipient?: SendRecipient | null
}

export function SendGhcFlow({
  open,
  onClose,
  availableBalance,
  onCompleted,
  limits = DEFAULT_ECONOMY_LIMITS,
  currentUserId = "current-user",
  initialRecipient = null,
}: SendGhcFlowProps) {
  const [step, setStep] = useState<Step>("recipient")
  const [query, setQuery] = useState("")
  const [recipient, setRecipient] = useState<SendRecipient | null>(null)
  const [manualId, setManualId] = useState("")
  const [amountRaw, setAmountRaw] = useState("")
  const [note, setNote] = useState("")
  const [errorTitle, setErrorTitle] = useState("")
  const [errorBody, setErrorBody] = useState("")
  const [receipt, setReceipt] = useState<{
    amount: number
    referenceId: string
    to: SendRecipient
    note?: string
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
    if (amount > availableBalance) return "Insufficient available GHC"
    return null
  }, [amountRaw, amount, minA, maxA, availableBalance])

  const quickChips = useMemo(() => {
    const base = [100, 250, 500, 1000].filter((n) => n >= minA && n <= maxA && n <= availableBalance)
    return base
  }, [minA, maxA, availableBalance])

  const previewAfter =
    amount != null && amount <= availableBalance && !amountError
      ? availableBalance - amount
      : null

  useEffect(() => {
    if (!open) {
      setStep("recipient")
      setQuery("")
      setRecipient(null)
      setManualId("")
      setAmountRaw("")
      setNote("")
      setErrorTitle("")
      setErrorBody("")
      setReceipt(null)
      referenceIdRef.current = null
      inFlightRef.current = false
      return
    }
    if (initialRecipient?.id) {
      setRecipient(initialRecipient)
      setStep("amount")
    }
  }, [open, initialRecipient])

  useEffect(() => {
    if (step === "amount") {
      window.setTimeout(() => amountInputRef.current?.focus(), 80)
    }
  }, [step])

  const selectRecipient = (r: SendRecipient) => {
    if (r.id === currentUserId) {
      setErrorTitle("Invalid recipient")
      setErrorBody("You cannot send GHC to yourself.")
      setStep("error")
      return
    }
    setRecipient(r)
    setStep("amount")
  }

  const useManualRecipient = () => {
    const id = manualId.trim()
    if (!id) return
    if (id === currentUserId) {
      setErrorTitle("Invalid recipient")
      setErrorBody("You cannot send GHC to yourself.")
      setStep("error")
      return
    }
    setRecipient({ id, name: id, username: id })
    setStep("amount")
  }

  const goReview = () => {
    if (!recipient || amount == null || amountError) return
    if (!referenceIdRef.current) {
      referenceIdRef.current = buildTransferReference(currentUserId, recipient.id, amount)
    }
    setStep("review")
  }

  const reconcileAndFinish = async (ref: string, to: SendRecipient, amt: number, noteText?: string) => {
    setStep("reconciling")
    try {
      const eco = getBoundDomainServices()?.economy as {
        hydrate?: () => Promise<void>
        getTransactions?: (n?: number) => Array<{ referenceId?: string; kind?: string }>
      } | null
      if (eco?.hydrate) await eco.hydrate()
      const txs = eco?.getTransactions?.(40) || []
      const found = txs.find((t) => t.referenceId === ref && t.kind === "transfer_out")
      if (found) {
        setReceipt({
          amount: amt,
          referenceId: ref,
          to,
          note: noteText,
          at: Date.now(),
        })
        setStep("success")
        onCompleted()
        return
      }
    } catch {
      /* */
    }
    const mapped = mapUserError("NETWORK_TIMEOUT")
    setErrorTitle(mapped.title)
    setErrorBody(mapped.body)
    setStep("error")
  }

  const confirmSend = useCallback(async () => {
    if (inFlightRef.current) return
    if (!recipient || amount == null) return

    const ref =
      referenceIdRef.current ||
      buildTransferReference(currentUserId, recipient.id, amount)
    referenceIdRef.current = ref

    inFlightRef.current = true
    setStep("sending")

    try {
      const eco = getBoundDomainServices()?.economy as {
        sendGhcToUser?: (i: {
          toUserId: string
          toUserName: string
          amount: number
          note?: string
          referenceId?: string
        }) => Promise<{ ok: boolean; error?: string; data?: { tx?: { referenceId?: string } } }>
        hydrate?: () => Promise<void>
      } | null

      if (!eco?.sendGhcToUser) {
        const m = mapUserError("SERVER_UNAVAILABLE")
        setErrorTitle(m.title)
        setErrorBody(m.body)
        setStep("error")
        return
      }

      const res = await eco.sendGhcToUser({
        toUserId: recipient.id,
        toUserName: recipient.name,
        amount,
        note: note.trim().slice(0, 120) || undefined,
        referenceId: ref,
      })

      if (!res.ok) {
        const err = res.error || ""
        if (/timeout|network/i.test(err)) {
          await reconcileAndFinish(ref, recipient, amount, note.trim() || undefined)
          return
        }
        const m = mapUserError(err)
        setErrorTitle(m.title)
        setErrorBody(m.body)
        setStep("error")
        return
      }

      if (eco.hydrate) {
        try {
          await eco.hydrate()
        } catch {
          /* local tick still refreshes */
        }
      }

      setReceipt({
        amount,
        referenceId: res.data?.tx?.referenceId || ref,
        to: recipient,
        note: note.trim() || undefined,
        at: Date.now(),
      })
      setStep("success")
      onCompleted()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "TRANSFER_FAILED"
      if (/timeout|network|fetch/i.test(msg)) {
        await reconcileAndFinish(ref, recipient, amount, note.trim() || undefined)
        return
      }
      const m = mapUserError(msg)
      setErrorTitle(m.title)
      setErrorBody(m.body)
      setStep("error")
    } finally {
      inFlightRef.current = false
    }
  }, [recipient, amount, note, currentUserId, onCompleted])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Send GHC"
    >
      <button type="button" className="absolute inset-0" aria-label="Close send flow" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          {step !== "success" && step !== "sending" && step !== "reconciling" && (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Back"
              onClick={() => {
                if (step === "recipient") onClose()
                else if (step === "amount") setStep("recipient")
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
              {step === "recipient" && "Send GHC"}
              {step === "amount" && "Enter amount"}
              {step === "review" && "Review transfer"}
              {step === "sending" && "Sending GHC…"}
              {step === "reconciling" && "Checking transfer status…"}
              {step === "success" && "GHC sent"}
              {step === "error" && "Transfer issue"}
            </p>
            <p className="text-[11px] text-muted-foreground">Internal GreenHaven Coin</p>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [-webkit-overflow-scrolling:touch]">
          {/* RECIPIENT */}
          {step === "recipient" && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-muted-foreground" htmlFor="send-search">
                Find a member
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="send-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or ID"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  autoComplete="off"
                />
              </div>
              <ul className="space-y-1" role="listbox" aria-label="Recipients">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="option"
                      onClick={() => selectRecipient(r)}
                      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 text-left transition hover:border-border hover:bg-muted/50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        {r.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User size={18} className="text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{r.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {r.username || r.id}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No matches in your network. Enter a GreenHaven ID below.
                  </li>
                )}
              </ul>
              <div className="border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="manual-id">
                  Or enter GreenHaven ID
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="manual-id"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                    placeholder="member-id"
                  />
                  <button
                    type="button"
                    onClick={useManualRecipient}
                    disabled={!manualId.trim()}
                    className="rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AMOUNT */}
          {step === "amount" && recipient && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User size={18} className="text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sending to
                  </p>
                  <p className="truncate text-sm font-bold text-foreground">{recipient.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{recipient.id}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="send-amount">
                  Amount
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <GhcCoinIcon size={22} />
                  <input
                    ref={amountInputRef}
                    id="send-amount"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    value={amountRaw}
                    onChange={(e) => setAmountRaw(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0.00"
                    className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums outline-none"
                    aria-invalid={!!amountError}
                    aria-describedby={amountError ? "amount-err" : "amount-avail"}
                  />
                  <span className="text-sm font-bold text-muted-foreground">GHC</span>
                </div>
                {amountError ? (
                  <p id="amount-err" className="mt-1.5 text-xs font-medium text-rose-600" role="alert">
                    {amountError}
                  </p>
                ) : (
                  <p id="amount-avail" className="mt-1.5 text-xs text-muted-foreground">
                    Available{" "}
                    <span className="font-semibold text-foreground">{formatGhc(availableBalance)} GHC</span>
                    {previewAfter != null && (
                      <>
                        {" "}
                        · After transfer{" "}
                        <span className="font-semibold text-foreground">{formatGhc(previewAfter)} GHC</span>
                        <span className="text-muted-foreground"> (preview)</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              {quickChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Quick amounts">
                  {quickChips.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAmountRaw(String(n))}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-emerald-300 hover:text-foreground"
                    >
                      {formatGhc(n)}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="send-note">
                  What&apos;s this for? <span className="font-normal">(optional)</span>
                </label>
                <input
                  id="send-note"
                  value={note}
                  maxLength={120}
                  onChange={(e) => setNote(e.target.value.slice(0, 120))}
                  placeholder="Optional note"
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

          {/* REVIEW */}
          {step === "review" && recipient && amount != null && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 px-4 py-5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  You are sending
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {formatGhc(amount)}{" "}
                  <span className="text-base font-bold text-muted-foreground">GHC</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">To</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                    <User size={20} className="text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{recipient.name}</p>
                    <p className="text-[11px] text-muted-foreground">{recipient.id}</p>
                  </div>
                </div>
              </div>
              {note.trim() && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Note</p>
                  <p className="mt-1 text-sm text-foreground">{note.trim()}</p>
                </div>
              )}
              <div className="rounded-xl border border-border px-3 py-2.5 text-xs text-muted-foreground">
                <p>
                  From <span className="font-semibold text-foreground">Your GHC Wallet</span>
                </p>
                <p className="mt-1">
                  Available <span className="font-semibold text-foreground">{formatGhc(availableBalance)} GHC</span>
                  {previewAfter != null && (
                    <>
                      {" "}
                      · After (preview){" "}
                      <span className="font-semibold text-foreground">{formatGhc(previewAfter)} GHC</span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void confirmSend()}
                disabled={inFlightRef.current}
                className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm shadow-emerald-600/25"
              >
                Confirm &amp; Send
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

          {/* SENDING / RECONCILING */}
          {(step === "sending" || step === "reconciling") && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" aria-hidden />
              <p className="mt-4 text-sm font-semibold text-foreground">
                {step === "sending" ? "Sending GHC…" : "Checking transfer status…"}
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Please wait. Do not close this screen until we confirm the result.
              </p>
            </div>
          )}

          {/* SUCCESS */}
          {step === "success" && receipt && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950">
                <CheckCircle2 size={28} aria-hidden />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">GHC sent successfully</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {formatGhc(receipt.amount)} GHC
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-left text-sm">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">To</p>
                <p className="font-bold text-foreground">{receipt.to.name}</p>
                <p className="text-[11px] text-muted-foreground">{receipt.to.id}</p>
                {receipt.note && (
                  <>
                    <p className="mt-2 text-[11px] font-semibold uppercase text-muted-foreground">Note</p>
                    <p className="text-foreground">{receipt.note}</p>
                  </>
                )}
                <p className="mt-2 text-[11px] font-semibold uppercase text-muted-foreground">Reference</p>
                <p className="break-all font-mono text-xs text-foreground">{receipt.referenceId}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{formatWhen(receipt.at)}</p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-700">Status · Completed</p>
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
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground"
              >
                View activity
              </button>
            </div>
          )}

          {/* ERROR */}
          {step === "error" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950">
                <AlertCircle size={28} aria-hidden />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{errorTitle}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{errorBody}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Keep same referenceId for retry after timeout-style errors
                  setStep("review")
                }}
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
