"use client"

/**
 * Withdrawal-PIN recovery UI.
 * - Not set up:  user answers 3 randomly assigned security questions (different per user/session draw).
 * - Set up:      "Reset withdrawal PIN" → answer all 3 → choose a new 6-digit PIN.
 * Server: /api/identity/pin-recovery (answers are hashed; 5 failures lock recovery for 15 min).
 */

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, ShieldCheck } from "lucide-react"

type Q = { id: string; text: string }
type Status = {
  ok?: boolean
  configured?: boolean
  locked?: boolean
  lockedUntil?: string | null
  questions?: Q[]
  error?: string
}

const ERRORS: Record<string, string> = {
  RECOVERY_ANSWERS_INCORRECT: "One or more answers don't match. Check spelling and try again.",
  RECOVERY_LOCKED: "Too many wrong attempts. Recovery is locked for 15 minutes.",
  RECOVERY_ANSWERS_MUST_DIFFER: "Use a different answer for each question.",
  RECOVERY_INPUT_INVALID: "Answer every question (2–80 characters).",
  RECOVERY_ALREADY_CONFIGURED: "Recovery questions are already set up.",
  RECOVERY_TABLE_PENDING: "Recovery storage isn't ready yet. Please contact support.",
  RECOVERY_NOT_CONFIGURED: "Recovery isn't set up for this account.",
  PIN_NOT_CONFIGURED: "Create a withdrawal PIN first.",
  PIN_FORMAT_INVALID: "Enter a matching 6-digit PIN.",
  RATE_LIMITED: "Too many requests. Wait a minute and retry.",
}

const field =
  "w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-violet-500"

export function PinRecoveryPanel({ onPinReset }: { onPinReset?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState<"setup" | "reset" | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/identity/pin-recovery", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })
      const b = (await r.json().catch(() => null)) as Status | null
      setStatus(r.ok && b?.ok ? b : { ok: false, error: b?.error || "UNAVAILABLE" })
    } catch {
      setStatus({ ok: false, error: "UNAVAILABLE" })
    }
  }, [])
  useEffect(() => { void load() }, [load])

  if (!status) return null
  if (!status.ok) {
    return status.error === "RECOVERY_TABLE_PENDING" ? null : (
      <p className="text-[11px] text-muted-foreground">PIN recovery is temporarily unavailable.</p>
    )
  }

  const configured = status.configured === true
  const questions = status.questions || []
  const allAnswered = questions.length === 3 && questions.every((q) => (answers[q.id] || "").trim().length >= 2)

  async function submit() {
    setBusy(true)
    setMsg(null)
    try {
      const payload = configured
        ? { action: "reset", answers, newPin, confirmPin }
        : { action: "setup", answers: questions.map((q) => ({ id: q.id, answer: answers[q.id] || "" })) }
      const r = await fetch("/api/identity/pin-recovery", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!r.ok || !b?.ok) {
        setMsg(ERRORS[b?.error || ""] || "Something went wrong. Please try again.")
        if (b?.error === "RECOVERY_LOCKED") void load()
        return
      }
      setAnswers({}); setNewPin(""); setConfirmPin("")
      setDone(configured ? "reset" : "setup")
      setOpen(false)
      if (configured) onPinReset?.()
      void load()
    } finally {
      setBusy(false)
    }
  }

  if (done && !open) {
    return (
      <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" role="status">
        <ShieldCheck className="h-3.5 w-3.5" />
        {done === "setup" ? "Recovery questions saved. Remember your answers." : "Withdrawal PIN reset. Enter your new PIN to continue."}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setMsg(null) }}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
      >
        <KeyRound className="h-3.5 w-3.5" />
        {configured ? "Reset withdrawal PIN" : "Secure PIN recovery"}
      </button>

      {open ? (
        <div className="space-y-2.5 rounded-2xl border border-border/60 bg-muted/30 p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {configured
              ? "Answer your 3 security questions to set a new withdrawal PIN."
              : "Choose three answers only you know. You will need the exact same answers to reset your PIN. GreenHaven never sends your PIN to Pi."}
          </p>
          {status.locked ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-950 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
              Recovery is locked after too many wrong attempts. Try again later.
            </p>
          ) : (
            <>
              {questions.map((q) => (
                <label key={q.id} className="block space-y-1">
                  <span className="text-[11px] font-semibold text-foreground">{q.text}</span>
                  <input
                    type="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    maxLength={80}
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    className={field}
                    placeholder="Your answer"
                  />
                </label>
              ))}
              {configured ? (
                <div className="grid grid-cols-2 gap-2">
                  {[["New 6-digit PIN", newPin, setNewPin], ["Confirm PIN", confirmPin, setConfirmPin]].map(([label, value, set]) => (
                    <input
                      key={label as string}
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="new-password"
                      value={value as string}
                      onChange={(e) => (set as (v: string) => void)(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className={`${field} font-semibold tracking-[0.3em]`}
                      placeholder={label as string}
                      aria-label={label as string}
                    />
                  ))}
                </div>
              ) : null}
              {msg ? <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300" role="alert">{msg}</p> : null}
              <button
                type="button"
                disabled={busy || !allAnswered || (configured && (newPin.length !== 6 || newPin !== confirmPin))}
                onClick={() => void submit()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {configured ? "Reset PIN" : "Save recovery questions"}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
