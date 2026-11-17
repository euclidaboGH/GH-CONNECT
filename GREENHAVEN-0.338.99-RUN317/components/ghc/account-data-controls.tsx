"use client"

import { useState } from "react"
import { confirmDialog, promptDialog } from "@/lib/ui/global-interactions"
import { authenticatePasskeyStepUp } from "@/lib/auth/webauthn-client"
import { Download, ShieldCheck, Trash2 } from "lucide-react"

function errorMessage(code: string, fallback: string) {
  if (code === "STEP_UP_REQUIRED" || code === "STEP_UP_EXPIRED") {
    return "This action needs fresh verification. Use Verify with passkey below, or sign in again with Pi."
  }
  if (code === "RATE_LIMITED") return "Too many attempts. Please wait before trying again."
  if (code === "EXPORT_INCOMPLETE") return "The export could not be completed safely. No partial file was created; try again later."
  return fallback
}

/** Owner-facing privacy rights controls; server endpoints remain the authority. */
export function AccountDataControls() {
  const [busy, setBusy] = useState<"export" | "deletion" | "verify" | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<"status" | "error">("status")

  const verifyPasskey = async () => {
    setBusy("verify")
    setMessage(null)
    try {
      const result = await authenticatePasskeyStepUp()
      if (!result.ok) throw new Error(result.error || "PASSKEY_VERIFICATION_FAILED")
      setMessage("Identity verified. Sensitive account actions are now available for a limited time.")
      setMessageKind("status")
    } catch (error) {
      setMessage(errorMessage(error instanceof Error ? error.message : "", "Passkey verification could not be completed. You can sign in again with Pi."))
      setMessageKind("error")
    } finally {
      setBusy(null)
    }
  }

  const exportData = async () => {
    setBusy("export")
    setMessage(null)
    try {
      const response = await fetch("/api/account/export", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null
      if (!response.ok || payload?.ok !== true) {
        throw new Error(String(payload?.error || `EXPORT_FAILED_${response.status}`))
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `greenhaven-account-export-${new Date().toISOString().slice(0, 10)}.json`
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setMessage("Your account export was prepared and downloaded. Keep the file somewhere private.")
      setMessageKind("status")
    } catch (error) {
      const code = error instanceof Error ? error.message : "EXPORT_FAILED"
      setMessage(errorMessage(code, "Your export is temporarily unavailable. Please try again."))
      setMessageKind("error")
    } finally {
      setBusy(null)
    }
  }

  const requestDeletion = async () => {
    const confirmed = await confirmDialog({
      title: "Request account deletion?",
      message: "This submits a formal deletion request; it does not immediately erase your account. GreenHaven must review outstanding balances, disputes, payout activity and records that must be retained by law or for ledger integrity.",
      confirmLabel: "Continue",
      cancelLabel: "Cancel",
      danger: true,
    })
    if (!confirmed) return
    const phrase = await promptDialog({
      title: "Confirm deletion request",
      message: "Type DELETE to confirm that you want GreenHaven to review an account deletion request.",
      label: "Confirmation",
      placeholder: "DELETE",
      maxLength: 6,
      pattern: "DELETE",
      confirmLabel: "Submit request",
    })
    if (phrase !== "DELETE") return

    setBusy("deletion")
    setMessage(null)
    try {
      const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `delete-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
      const response = await fetch("/api/account/lifecycle", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ requestType: "deletion" }),
      })
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null
      if (!response.ok || payload?.ok !== true) {
        throw new Error(String(payload?.error || `DELETION_REQUEST_FAILED_${response.status}`))
      }
      setMessage(`Deletion request ${String(payload.requestId || "received")} was recorded. Your account remains active until the review and any required retention steps are completed.`)
      setMessageKind("status")
    } catch (error) {
      const code = error instanceof Error ? error.message : "DELETION_REQUEST_FAILED"
      setMessage(errorMessage(code, "The deletion request could not be submitted. Please try again."))
      setMessageKind("error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--gh-card-shadow)] space-y-3" aria-labelledby="account-data-controls-title">
      <div>
        <p id="account-data-controls-title" className="text-[14px] font-bold">Your data &amp; account</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Access a copy of supported GreenHaven records or submit a formal account deletion request. Sensitive actions require recent identity verification.</p>
      </div>
      <button type="button" onClick={() => void exportData()} disabled={busy !== null} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-[13px] font-bold text-white disabled:opacity-50">
        <Download size={16} /> {busy === "export" ? "Preparing export…" : "Download my data"}
      </button>
      <button type="button" onClick={() => void verifyPasskey()} disabled={busy !== null} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-[12px] font-semibold disabled:opacity-50">
        <ShieldCheck size={16} /> {busy === "verify" ? "Verifying…" : "Verify with passkey"}
      </button>
      <div className="border-t border-border/70 pt-3">
        <button type="button" onClick={() => void requestDeletion()} disabled={busy !== null} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-2.5 text-[12px] font-bold text-red-700 disabled:opacity-50 dark:text-red-300">
          <Trash2 size={16} /> {busy === "deletion" ? "Submitting request…" : "Request account deletion"}
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">A request is not an immediate deletion. Wallet, payment, dispute and legally required records may need restricted retention. No balance is forfeited or payment action triggered by submitting this request.</p>
      </div>
      {message ? <p role={messageKind === "error" ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-[11px] leading-relaxed ${messageKind === "error" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-muted/60 text-foreground"}`}>{message}</p> : null}
    </section>
  )
}
