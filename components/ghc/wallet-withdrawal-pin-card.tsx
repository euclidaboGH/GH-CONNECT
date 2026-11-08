"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, ShieldCheck, RefreshCw } from "lucide-react"
import { PinRecoveryPanel } from "@/components/ghc/pin-recovery-panel"

type PinStatus = {
  ok?: boolean
  configured?: boolean
  locked?: boolean
  lockedUntil?: string | null
  error?: string
}

const FIELD = "w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm font-semibold tracking-[0.28em] text-foreground outline-none focus:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/30"

function statusMessage(error?: string): string {
  switch (error) {
    case "PIN_TABLE_PENDING": return "PIN storage is not ready on this environment yet. No PIN was created. Please contact support."
    case "PIN_SERVICE_UNAVAILABLE": return "PIN security is temporarily unavailable. Try again later."
    case "AUTH_REQUIRED": return "Your session has expired. Sign in again to manage your withdrawal PIN."
    default: return "We could not confirm your withdrawal PIN status. Setup is disabled until the security service responds."
  }
}

export function WalletWithdrawalPinCard() {
  const [status, setStatus] = useState<PinStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/identity/withdrawal-pin", {
        credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
      })
      const body = (await response.json().catch(() => null)) as PinStatus | null
      setStatus(response.ok && body?.ok === true && typeof body.configured === "boolean"
        ? body
        : { ok: false, error: body?.error || "PIN_SERVICE_UNAVAILABLE" })
    } catch {
      setStatus({ ok: false, error: "PIN_SERVICE_UNAVAILABLE" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const createPin = async () => {
    if (pin.length !== 6 || confirmPin.length !== 6 || pin !== confirmPin || busy || status?.ok !== true || status.configured !== false) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch("/api/identity/withdrawal-pin", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", pin, confirmPin }),
      })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null
      if (!response.ok || body?.ok !== true) {
        const error = body?.error || "PIN_SETUP_FAILED"
        const copy: Record<string, string> = {
          PIN_FORMAT_INVALID: "Enter and confirm a six-digit numeric PIN.",
          PIN_TOO_WEAK: "Choose a less predictable PIN. Avoid repeated digits or simple sequences.",
          PIN_MISMATCH: "The two PIN entries do not match.",
          PIN_ALREADY_CONFIGURED: "A withdrawal PIN already exists. Use Forgot PIN? to recover it; setup cannot overwrite it.",
          RATE_LIMITED: "Too many attempts. Wait before trying again.",
          PIN_SERVICE_UNAVAILABLE: "PIN security is temporarily unavailable. No PIN was saved.",
          PIN_PERSIST_FAILED: "Your PIN could not be saved. No successful setup was recorded.",
        }
        setMessage({ kind: "error", text: copy[error] || "PIN setup could not be completed. Please try again." })
        if (error === "PIN_ALREADY_CONFIGURED") void refresh()
        return
      }
      setPin("")
      setConfirmPin("")
      setMessage({ kind: "success", text: "Your withdrawal PIN is set. Keep it private; GreenHaven will never ask you to send it to Pi." })
      await refresh()
    } catch {
      setMessage({ kind: "error", text: "Connection interrupted. We could not confirm whether setup completed; refresh the status before retrying." })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20" aria-labelledby="wallet-withdrawal-pin-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"><KeyRound size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 id="wallet-withdrawal-pin-title" className="text-sm font-bold text-foreground">Pi withdrawal PIN</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">This is your GreenHaven six-digit withdrawal PIN. At present it protects Pi withdrawals; other transaction types keep their own authorization rules. It is separate from your login or device-unlock PIN and is not your Pi wallet passphrase.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="rounded-full p-2 text-muted-foreground hover:bg-background disabled:opacity-50" aria-label="Refresh withdrawal PIN status"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
      </div>

      {loading ? <p className="mt-3 text-xs text-muted-foreground" role="status">Checking secure PIN status…</p> : null}
      {!loading && status?.ok !== true ? (
        <div className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
          {statusMessage(status?.error)}
        </div>
      ) : null}
      {!loading && status?.ok === true && status.configured === true ? (
        <div className="mt-3 space-y-2.5">
          <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-background/80 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:border-emerald-900 dark:text-emerald-200" role="status"><ShieldCheck size={14} /> Withdrawal PIN configured{status.locked ? " · temporarily locked after failed attempts" : ""}</p>
          <PinRecoveryPanel onPinReset={() => { setMessage({ kind: "success", text: "Your withdrawal PIN was reset. Use your new PIN for the next withdrawal." }); void refresh() }} />
        </div>
      ) : null}
      {!loading && status?.ok === true && status.configured === false ? (
        <div className="mt-3 space-y-2.5">
          <p className="text-[11px] leading-relaxed text-muted-foreground">Create this PIN before requesting a Pi withdrawal. Choose a number that is hard to guess and do not reuse your Pi wallet passphrase.</p>
          <label className="block space-y-1"><span className="text-[10px] font-bold text-muted-foreground">Create 6-digit PIN</span><input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} className={FIELD} placeholder="••••••" aria-label="Create six-digit withdrawal PIN" /></label>
          <label className="block space-y-1"><span className="text-[10px] font-bold text-muted-foreground">Confirm PIN</span><input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))} className={FIELD} placeholder="••••••" aria-label="Confirm six-digit withdrawal PIN" /></label>
          {pin.length === 6 && confirmPin.length === 6 && pin !== confirmPin ? <p className="text-[11px] text-rose-700 dark:text-rose-300" role="alert">The PIN entries do not match.</p> : null}
          <button type="button" onClick={() => void createPin()} disabled={busy || pin.length !== 6 || confirmPin.length !== 6 || pin !== confirmPin} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <><Loader2 size={15} className="animate-spin" /> Saving securely…</> : "Create withdrawal PIN"}</button>
        </div>
      ) : null}
      {message ? <p className={`mt-3 rounded-xl px-3 py-2 text-[11px] leading-relaxed ${message.kind === "success" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100" : "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100"}`} role="status" aria-live="polite">{message.text}</p> : null}
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">PINs are hashed and verified by GreenHaven's server. They are never stored in browser storage and are never sent to Pi. Recovery is available after setup.</p>
    </section>
  )
}
