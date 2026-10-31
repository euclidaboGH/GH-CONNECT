"use client"

/** Read-only Pi payment receipt/details. Displays persisted intent fields only. */
import { useEffect, useMemo, useState } from "react"
import { Check, Copy, Download, Share2, X, RefreshCw } from "lucide-react"
import { coordinatedRecoverPayment } from "@/lib/payments/coordinated-recovery"

export type PiPaymentDetailRecord = {
  id: string
  status?: string
  amountPi?: number
  currency?: string
  purpose?: string
  productId?: string
  productLabel?: string
  referenceId?: string
  createdAt?: number
  paymentId?: string
}

type ReconciliationFinding = { intentId: string; purpose: string; reconciliation: string; code: string; message: string }

function readableStatus(status?: string) {
  const key = String(status || "").toUpperCase()
  const labels: Record<string, string> = {
    CREATED: "Awaiting approval", APPROVAL_PENDING: "Approval pending", APPROVED: "Approved",
    USER_SUBMITTED: "Submitted", COMPLETION_PENDING: "Confirming payment", COMPLETED: "Paid · fulfilment pending",
    FULFILLED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled", REFUNDED: "Refunded", INCOMPLETE: "Needs attention",
  }
  return labels[key] || String(status || "Status unavailable").replaceAll("_", " ")
}

function formattedDate(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return "Date unavailable"
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function PiPaymentDetail({ intent, finding, onClose }: { intent: PiPaymentDetailRecord | null; finding?: ReconciliationFinding; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<{ at: number; action: string; actor: string | null; detail: string | null }[]>([])
  const [timelineNote, setTimelineNote] = useState<string | null>(null)
  const [recoverBusy, setRecoverBusy] = useState(false)
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null)
  useEffect(() => {
    setTimelineOpen(false)
    setTimeline([])
    setTimelineError(null)
    setTimelineNote(null)
  }, [intent?.id])
  const loadTimeline = async () => {
    if (!intent) return
    setTimelineOpen(true)
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const response = await fetch(`/api/payments/intents/${encodeURIComponent(intent.id)}/timeline`, { cache: "no-store", headers: { Accept: "application/json" } })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok || !Array.isArray(data.events)) throw new Error("The stored payment history is temporarily unavailable.")
      setTimeline(data.events)
      setTimelineNote(typeof data.note === "string" ? data.note : "Only persisted audit events are shown.")
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : "The stored payment history is temporarily unavailable.")
    } finally {
      setTimelineLoading(false)
    }
  }
  const receipt = useMemo(() => {
    if (!intent) return ""
    return [
      "GreenHaven · Pi Payment Receipt / Record",
      `Description: ${intent.productLabel || intent.productId || intent.purpose || "Pi payment"}`,
      `Amount: ${typeof intent.amountPi === "number" ? `${intent.amountPi.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${String(intent.currency || "PI").toUpperCase()}` : "Amount unavailable"}`,
      `Current status: ${readableStatus(intent.status)}`,
      `Created: ${formattedDate(intent.createdAt)}`,
      `Intent ID: ${intent.id}`,
      `Reference ID: ${intent.referenceId || "Not provided"}`,
      `Pi provider payment ID: ${intent.paymentId || "Not provided"}`,
      `Reconciliation: ${finding ? `${finding.reconciliation} — ${finding.message}` : "No matching finding returned; this is not proof of fulfilment."}`,
      "This is a copy of the payment-intent record, not proof of provider settlement or product delivery.",
    ].join("\n")
  }, [intent, finding])
  useEffect(() => {
    if (!intent) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [intent, onClose])
  if (!intent) return null

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(receipt)
      setCopied(true); setFeedback("Receipt details copied.")
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setFeedback("Copy is unavailable in this browser. You can download the receipt text instead.") }
  }
  const shareReceipt = async () => {
    try {
      if (!navigator.share) { setFeedback("Sharing is not supported here. Use Copy receipt or Download receipt."); return }
      await navigator.share({ title: "GreenHaven payment record", text: receipt })
      setFeedback("Receipt shared.")
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setFeedback("The receipt could not be shared. Try copying or downloading it.")
    }
  }
  const downloadSupportSummary = () => {
    try {
      const supportSummary = [
        "GreenHaven · Payment recovery support summary",
        `Description: ${intent.productLabel || intent.productId || intent.purpose || "Pi payment"}`,
        `Current status: ${readableStatus(intent.status)}`,
        `Amount: ${typeof intent.amountPi === "number" ? `${intent.amountPi.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${String(intent.currency || "PI").toUpperCase()}` : "Amount unavailable"}`,
        `Created: ${formattedDate(intent.createdAt)}`,
        `Payment intent ID: ${intent.id}`,
        `Reference ID: ${intent.referenceId || "Not provided"}`,
        `Pi provider payment ID: ${intent.paymentId || "Not provided"}`,
        `Reconciliation result: ${finding ? finding.reconciliation : "No finding available"}`,
        `Diagnostic code: ${finding?.code || "Not available"}`,
        `Diagnostic message: ${finding?.message || "No feature-specific finding returned."}`,
        "Safety note: this summary contains record identifiers and diagnostic details only. It is not proof of settlement, refund, or fulfilment.",
      ].join("\n")
      const blob = new Blob([supportSummary], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url; anchor.download = `greenhaven-payment-support-${intent.id.slice(0, 12)}.txt`
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
      setFeedback("Support summary downloaded. Review it before sharing; it contains payment identifiers.")
    } catch { setFeedback("Support summary download is unavailable in this browser.") }
  }
  const downloadReceipt = () => {
    try {
      const blob = new Blob([receipt], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url; anchor.download = `greenhaven-payment-${intent.id.slice(0, 12)}.txt`
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
      setFeedback("Receipt text downloaded.")
    } catch { setFeedback("Download is unavailable in this browser.") }
  }

  const status = String(intent.status || "").toUpperCase()
  const paid = ["COMPLETED", "FULFILLED", "REFUNDED"].includes(status)
  const failed = ["FAILED", "CANCELLED", "INCOMPLETE"].includes(status)
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pi-payment-detail-title">
      <button type="button" className="absolute inset-0" aria-label="Close payment details" onClick={onClose} />
      <section className="relative z-[1] flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-border px-4 py-4">
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pi payment record</p><h2 id="pi-payment-detail-title" className="truncate text-lg font-bold">Transaction details</h2></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-muted"><X size={19}/></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold">{intent.productLabel || intent.productId || intent.purpose || "Pi payment"}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{typeof intent.amountPi === "number" ? intent.amountPi.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "—"}<span className="ml-2 text-base text-muted-foreground">{String(intent.currency || "PI").toUpperCase()}</span></p>
            <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${paid ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : failed ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}>{readableStatus(intent.status)}</span>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <h3 className="text-sm font-bold">Record details</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Created</dt><dd className="text-right font-medium">{formattedDate(intent.createdAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Purpose</dt><dd className="max-w-[65%] break-words text-right font-medium">{intent.purpose || "Not provided"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Intent ID</dt><dd className="max-w-[65%] break-all text-right font-mono text-xs">{intent.id}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Reference ID</dt><dd className="max-w-[65%] break-all text-right font-mono text-xs">{intent.referenceId || "Not provided"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pi payment ID</dt><dd className="max-w-[65%] break-all text-right font-mono text-xs">{intent.paymentId || "Not provided"}</dd></div>
              {intent.productId && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Product ID</dt><dd className="max-w-[65%] break-all text-right font-mono text-xs">{intent.productId}</dd></div>}
            </dl>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <h3 className="text-sm font-bold">Reconciliation & next steps</h3>
            {finding ? <><p className="mt-2 text-sm font-semibold">{finding.reconciliation.replaceAll("_", " ")}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{finding.message}</p><p className="mt-2 font-mono text-[10px] text-muted-foreground">Diagnostic: {finding.code}</p></> : <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No feature-specific finding was returned for this intent. This alone does not prove that a purchase was fulfilled.</p>}
            {status === "COMPLETED" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">The payment record says paid, but delivery or entitlement is not confirmed by this status alone. If the purchase is missing, keep this intent ID and reference for support.</p>}
            {failed && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">This record is not shown as successfully completed. Check the payment status in Pi Browser before retrying, to avoid accidental duplicate payment.</p>}
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <h4 className="text-xs font-bold">Recovery guidance</h4>
              {status === "COMPLETED" ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">The payment is recorded as paid, but feature fulfilment is not necessarily complete. Do not pay again just because an item or entitlement is missing. Keep the intent and reference IDs and contact support with the summary below.</p>
              ) : status === "FULFILLED" ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">The stored payment intent is marked fulfilled. If the related feature still appears unavailable, refresh the feature and provide the payment identifiers to support; this screen does not independently verify every feature mapping.</p>
              ) : ["FAILED", "CANCELLED", "INCOMPLETE"].includes(status) ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Before starting another payment, check the transaction in Pi Browser and confirm whether the provider shows it as completed. If the result is uncertain, use the support summary rather than creating a duplicate payment.</p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">This payment is not yet shown as fully completed. Wait for the provider result or refresh the payment history. Avoid submitting a second payment while the first result is uncertain.</p>
              )}
              <button type="button" onClick={() => { if (timelineOpen) setTimelineOpen(false); else void loadTimeline() }} className="mt-3 flex min-h-10 w-full items-center justify-center rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted">{timelineOpen ? "Hide payment history" : "View stored payment history"}</button>
              {timelineOpen && <div className="mt-3 space-y-3" aria-live="polite">
                {timelineLoading && <p className="text-xs text-muted-foreground">Loading persisted payment events…</p>}
                {timelineError && <p className="text-xs text-rose-700 dark:text-rose-300">{timelineError} You can try again.</p>}
                {!timelineLoading && !timelineError && timeline.length === 0 && <p className="text-xs text-muted-foreground">No persisted audit events are available. GreenHaven will not invent missing events or timestamps.</p>}
                {!timelineLoading && timeline.map((event, index) => <div key={`${event.at}-${index}`} className="border-l-2 border-emerald-700/40 pl-3">
                  <p className="text-xs font-bold">{event.action.replaceAll("_", " ")}</p>
                  <p className="text-[10px] text-muted-foreground">{formattedDate(event.at)}{event.actor ? ` · ${event.actor}` : ""}</p>
                  {event.detail && <p className="mt-1 break-words text-xs text-muted-foreground">{event.detail}</p>}
                </div>)}
                {timelineNote && <p className="text-[10px] leading-relaxed text-muted-foreground">{timelineNote}</p>}
                {timelineError && <button type="button" onClick={() => void loadTimeline()} className="min-h-9 rounded-lg border border-border px-3 text-xs font-bold">Try again</button>}
              </div>}
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">no synthetic timeline is displayed. This history is limited to saved intent audit events; it is not a complete Pi provider or blockchain event feed.</p>
            </div>
          </div>
          {feedback && <p className="text-xs text-muted-foreground" role="status">{feedback}</p>}
        </div>
        <footer className="grid grid-cols-3 gap-2 border-t border-border p-3">
          <button type="button" onClick={() => void copyReceipt()} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-2 text-xs font-bold hover:bg-muted">{copied ? <Check size={15}/> : <Copy size={15}/>} Copy</button>
          <button type="button" onClick={shareReceipt} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-2 text-xs font-bold hover:bg-muted"><Share2 size={15}/> Share</button>
          <button type="button" onClick={downloadReceipt} className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-1.5 text-xs font-bold text-white hover:bg-emerald-800"><Download size={14}/> Receipt</button>
          <button
            type="button"
            disabled={recoverBusy || !intent?.id}
            onClick={() => {
              if (!intent?.id || recoverBusy) return
              setRecoverBusy(true)
              setRecoverMsg(null)
              void coordinatedRecoverPayment(intent.id, {
                paymentId: intent.paymentId,
                purpose: intent.purpose,
              })
                .then((r) => {
                  if (!r.ok) {
                    setRecoverMsg(r.error || r.intentRecover?.message || "Recovery could not complete")
                    return
                  }
                  const st = r.intentRecover?.intent?.status
                  const mem = r.membershipReconcile?.granted || r.intentRecover?.membership?.granted
                  setRecoverMsg(
                    mem
                      ? "Recovery finished — membership checked against server entitlements."
                      : st
                        ? `Recovery finished — payment status is now ${st}.`
                        : "Recovery finished. Refresh wallet or membership if benefits are still pending.",
                  )
                })
                .catch(() => setRecoverMsg("Recovery request failed"))
                .finally(() => setRecoverBusy(false))
            }}
            className="col-span-3 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-600/40 bg-amber-500/10 px-2 text-xs font-bold text-amber-900 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-100"
          >
            <RefreshCw size={14} className={recoverBusy ? "animate-spin" : ""} aria-hidden />
            {recoverBusy ? "Recovering…" : "Recover payment"}
          </button>
          {recoverMsg ? <p className="col-span-3 text-center text-[11px] text-muted-foreground" role="status">{recoverMsg}</p> : null}
          <button type="button" onClick={downloadSupportSummary} className="col-span-3 flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-2 text-xs font-bold hover:bg-muted">Download support summary</button>
        </footer>
      </section>
    </div>
  )
}
