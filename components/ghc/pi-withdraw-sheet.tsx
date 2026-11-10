"use client"

/**
 * Exchange-style Pi withdrawal sheet.
 * Flow: wallet authorization check → (if missing) genuine Pi consent → quote → review → PIN → submit.
 * The quote is NEVER requested until the server confirms an active authorization whose Pi UID
 * matches the linked identity. Consent uses Pi.authenticate + server-side verification
 * (lib/client/pi-wallet-consent.ts); the browser never supplies a UID or an "authorized" flag.
 * Never invents paid results; A2U execution remains Testnet-flag and worker dependent.
 */

import { PinRecoveryPanel } from "./pin-recovery-panel"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Eye, EyeOff, Loader2, ShieldCheck, X, Wallet } from "lucide-react"
import { apiRequest } from "@/lib/client/api-request"
import { userFacingError } from "@/lib/ux/user-facing-errors"
import { fetchWalletAuthorizationStatus, requestPiWalletConsent } from "@/lib/client/pi-wallet-consent"
import {
  atomicToPiString,
  floorPiToAtomic,
  formatPiAmount,
  parsePiInput,
  piInputMessage,
} from "@/lib/wallet/pi-amount"

type LimitHints = { availableAtomic?: number; minPayoutAtomic?: number; maxSinglePayoutAtomic?: number }

function humanizeApiError(code?: string | null, message?: string | null, hints?: LimitHints): string {
  if (message && !/^[A-Z][A-Z0-9_]{3,}$/.test(message.trim())) return message
  const c = (code || "").toUpperCase()
  if (c === "WALLET_AUTHORIZATION_REQUIRED") {
    return "Authorize your Pi wallet in this sheet to continue."
  }
  if (c === "WALLET_AUTHORIZATION_UNAVAILABLE") {
    return "Wallet authorization is temporarily unavailable. Withdrawals remain blocked; please try again shortly."
  }
  if (c === "INSUFFICIENT_WITHDRAWABLE" || c === "INSUFFICIENT_BALANCE" || c === "INSUFFICIENT_AVAILABLE_EARNINGS") {
    return typeof hints?.availableAtomic === "number"
      ? `Not enough withdrawable Pi. Available: ${formatPi(hints.availableAtomic / PI_SCALE)} π.`
      : "Not enough withdrawable Pi for this amount."
  }
  if (c === "BELOW_MIN_PAYOUT") {
    return typeof hints?.minPayoutAtomic === "number"
      ? `The minimum withdrawal is ${formatPi(hints.minPayoutAtomic / PI_SCALE)} π.`
      : "That amount is below the minimum withdrawal."
  }
  if (c === "ABOVE_MAX_SINGLE_PAYOUT") {
    return typeof hints?.maxSinglePayoutAtomic === "number"
      ? `The maximum single withdrawal is ${formatPi(hints.maxSinglePayoutAtomic / PI_SCALE)} π.`
      : "That amount is above the maximum single withdrawal."
  }
  if (c === "LINKED_PI_IDENTITY_REQUIRED") {
    return "Sign in with Pi so your wallet is linked before withdrawing."
  }
  if (c === "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED") {
    return "Withdrawal requests are not enabled on this deployment yet."
  }
  if (c === "PI_EARNINGS_PAYOUT_EXECUTION_DISABLED") {
    return "Withdrawals are not being processed yet. Your balance is untouched and stays available."
  }
  if (c === "AMOUNT_REQUIRED" || c === "AMOUNT_TOO_SMALL") {
    return "Enter a valid Pi amount to withdraw."
  }
  return userFacingError(code || message)
}

type Props = {
  open: boolean
  onClose: () => void
  availablePi?: number | null
  linkedUsername?: string | null
  onCompleted?: () => void
  /** Opens Wallet → Security & PIN, where the withdrawal PIN is created and changed. */
  onSetupPin?: () => void
}

type AuthSnap = {
  authorizationActive: boolean
  mappedUsername: string | null
  hasMapping: boolean
  /** Linked Pi app UID when the server reports one (never shown in full when sensitive). */
  piAppUid?: string | null
  uidMatches?: boolean
}

const PI_SCALE = 10_000_000 // must equal PI_ATOMIC_SCALE in lib/wallet/pi-amount.ts

function floorToAtomic(pi: number): number {
  return floorPiToAtomic(pi)
}

function atomicToPi(atomic: number): number {
  return atomic / PI_SCALE
}

function formatPi(n: number): string {
  return formatPiAmount(n)
}

export function PiWithdrawSheet({ open, onClose, availablePi, linkedUsername, onCompleted, onSetupPin }: Props) {
  const [amountStr, setAmountStr] = useState("")
  const [auth, setAuth] = useState<AuthSnap | null>(null)
  const quoteSeq = useRef(0)
  // One idempotency key per withdrawal intent: network retries of the same amount reuse it, so a
  // retry can never create a second payout request. Cleared only after the server accepts it.
  const intentRef = useRef<{ amountAtomic: number; key: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [quote, setQuote] = useState<{
    amountAtomic: number
    gross: number
    fee: number
    net: number
    recipientUsername?: string | null
  } | null>(null)
  const [consentError, setConsentError] = useState<{ message: string; retryable: boolean } | null>(null)
  const [consentDone, setConsentDone] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [confirmCode, setConfirmCode] = useState("")
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null)
  const [pinStatusError, setPinStatusError] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)

  // Sticky max: once we have a positive withdrawable figure for this open session,
  // do not regress to 0 when the parent briefly re-hydrates with null (looks like a reserve wipe).
  const incomingMax =
    typeof availablePi === "number" && Number.isFinite(availablePi) ? Math.max(0, availablePi) : null
  const stickyMaxRef = useRef<number>(0)
  if (open && incomingMax !== null && incomingMax > 0) {
    stickyMaxRef.current = incomingMax
  }
  if (!open) {
    stickyMaxRef.current = 0
  }
  const maxPi = incomingMax !== null && incomingMax > 0
    ? incomingMax
    : stickyMaxRef.current > 0
      ? stickyMaxRef.current
      : incomingMax === 0
        ? 0
        : stickyMaxRef.current
  const latestMaxPiRef = useRef(maxPi)
  latestMaxPiRef.current = maxPi
  const loadAuthRef = useRef<(() => Promise<boolean>) | null>(null)
  /** Only reset form state on closed→open; parent remounts or balance hydration must not wipe amount/PIN. */
  const wasOpenRef = useRef(false)
  const sessionIdRef = useRef(0)
  const amountTouchedRef = useRef(false)

  const loadAuth = useCallback(async (): Promise<boolean> => {
    setAuthLoading(true)
    try {
      // Database-backed status; a browser flag is never trusted. Bound the wait so the sheet cannot hang.
      const res = await Promise.race([
        fetchWalletAuthorizationStatus(),
        new Promise<{ ok: false; code: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, code: "AUTH_STATUS_TIMEOUT" }), 10_000),
        ),
      ])
      if (res.ok) {
        const active = res.status.authorizationActive === true && res.status.uidMatchesAuthorization === true
        setAuth({
          authorizationActive: active,
          mappedUsername: res.status.mappedUsername || linkedUsername || null,
          hasMapping: res.status.hasMapping === true,
          piAppUid: res.status.authorizedPiAppUid || null,
          uidMatches: res.status.uidMatchesAuthorization === true,
        })
        return active
      }
      setAuth({
        authorizationActive: false,
        mappedUsername: linkedUsername || null,
        hasMapping: false,
        piAppUid: null,
        uidMatches: false,
      })
      if (!res.ok && "code" in res && res.code === "AUTH_STATUS_TIMEOUT") {
        setConsentError({
          message: "Could not verify wallet authorization in time. Check your connection and try again.",
          retryable: true,
        })
      }
      return false
    } catch {
      setAuth({
        authorizationActive: false,
        mappedUsername: linkedUsername || null,
        hasMapping: false,
        piAppUid: null,
        uidMatches: false,
      })
      return false
    } finally {
      setAuthLoading(false)
    }
  }, [linkedUsername])
  loadAuthRef.current = loadAuth

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      // Never keep a typed PIN around once the sheet is closed.
      setPinInput("")
      setShowPin(false)
      return
    }
    // Initialise once per open transition. Balance and linked-identity hydration must
    // never reset an amount/PIN while the user is completing the withdrawal.
    // Re-entry while already open (parent re-render / remount with open still true): keep form.
    if (wasOpenRef.current) return
    wasOpenRef.current = true
    sessionIdRef.current += 1
    amountTouchedRef.current = false
    setMsg(null)
    setQuote(null)
    setConsentChecked(false)
    setConsentError(null)
    setConsentDone(false)
    setConfirmCode("")
    setPinInput("")
    setPinConfigured(null)
    setPinStatusError(null)
    quoteSeq.current += 1
    intentRef.current = null
    // Start empty: pre-filling the whole balance led users to reserve everything by accident.
    // "Max" below remains one tap for anyone who wants to withdraw the full amount.
    setAmountStr("")
    void loadAuthRef.current?.()
    const sessionAtOpen = sessionIdRef.current
    ;(async () => {
      try {
        const res = await fetch("/api/identity/withdrawal-pin", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        if (sessionAtOpen !== sessionIdRef.current) return
        const body = (await res.json().catch(() => null)) as { ok?: boolean; configured?: boolean; error?: string } | null
        if (res.ok && body?.ok === true && typeof body.configured === "boolean") {
          setPinConfigured(body.configured)
          setPinStatusError(null)
        } else {
          setPinConfigured(null)
          setPinStatusError(body?.error === "PIN_TABLE_PENDING"
            ? "Withdrawal PIN storage is not ready. Please contact support; no PIN was created."
            : "Could not verify your withdrawal PIN status. Try again before continuing.")
        }
      } catch {
        if (sessionAtOpen === sessionIdRef.current) {
          setPinConfigured(null)
          setPinStatusError("Could not verify your withdrawal PIN status. Check your connection and reopen the withdrawal sheet.")
        }
      }
    })()
  }, [open])

  const parsedAmount = useMemo(() => parsePiInput(amountStr), [amountStr])
  const amountError = amountStr.trim() && !parsedAmount.ok ? piInputMessage(parsedAmount.code) : null
  const amountPi = useMemo(() => {
    if (!parsedAmount.ok) return 0
    const n = parsedAmount.atomic / PI_SCALE
    // Do not clamp typed amount to a still-hydrating maxPi (0) — that zeros the field while typing.
    if (maxPi > 0) return Math.min(n, maxPi)
    return n
  }, [parsedAmount, maxPi])

  const overBalance = parsedAmount.ok && maxPi > 0 && parsedAmount.atomic > floorToAtomic(maxPi)

  const feePreview = useMemo(() => {
    if (amountPi <= 0) return null
    const grossAtomic = floorToAtomic(amountPi)
    const feeAtomic = Math.ceil((grossAtomic * 300) / 10_000)
    const netAtomic = Math.max(0, grossAtomic - feeAtomic)
    return {
      gross: atomicToPi(grossAtomic),
      fee: atomicToPi(feeAtomic),
      net: atomicToPi(netAtomic),
    }
  }, [amountPi])

  useEffect(() => {
    // A quote is only valid for the exact amount it was issued for.
    setQuote((q) => (q && q.amountAtomic !== floorToAtomic(amountPi) ? null : q))
  }, [amountPi])

  const destination = auth?.mappedUsername || linkedUsername || null
  const needsConsent = auth !== null && auth.authorizationActive !== true
  const expectedConfirm = (destination || "PI").slice(0, 4).toUpperCase()

  /**
   * Server quote. Callers must have confirmed active authorization first; the
   * server (gh_earnings_quote_withdrawal) still enforces it independently.
   */
  const runQuote = async (): Promise<boolean> => {
    if (amountPi <= 0) {
      setMsg("Enter an amount to withdraw.")
      return false
    }
    const seq = ++quoteSeq.current
    setQuoting(true)
    setMsg(null)
    setQuote(null)
    try {
      const amountAtomic = floorToAtomic(amountPi)
      const res = await apiRequest<{
        ok?: boolean
        error?: string
        message?: string
        grossPi?: number
        feePi?: number
        netPi?: number
        grossAtomic?: number
        feeAtomic?: number
        netAtomic?: number
        recipientUsername?: string | null
        availableAtomic?: number
        minPayoutAtomic?: number
        maxSinglePayoutAtomic?: number
      }>("/api/economy/earnings/quote", {
        method: "POST",
        body: { amountAtomic },
        timeoutMs: 20_000,
      })
      if (seq !== quoteSeq.current) return false
      const body = res.data
      if (!res.ok || !body?.ok) {
        const code = body?.error || res.code || ""
        if (code === "WALLET_AUTHORIZATION_REQUIRED") {
          // Authorization changed server-side (e.g. revoked in another tab): re-check from the database.
          setConsentDone(false)
          await loadAuth()
          setMsg("Your wallet authorization is no longer active. Please authorize again.")
        } else {
          setMsg(humanizeApiError(code, body?.message, body ?? undefined))
        }
        return false
      }
      const grossAtomic = typeof body.grossAtomic === "number" ? body.grossAtomic : amountAtomic
      const gross = typeof body.grossPi === "number" ? body.grossPi : atomicToPi(grossAtomic)
      const fee =
        typeof body.feePi === "number"
          ? body.feePi
          : typeof body.feeAtomic === "number"
            ? atomicToPi(body.feeAtomic)
            : feePreview?.fee ?? 0
      const net =
        typeof body.netPi === "number"
          ? body.netPi
          : typeof body.netAtomic === "number"
            ? atomicToPi(body.netAtomic)
            : feePreview?.net ?? 0
      setQuote({
        amountAtomic: grossAtomic,
        gross,
        fee,
        net,
        recipientUsername: body.recipientUsername || destination,
      })
      return true
    } catch {
      if (seq === quoteSeq.current) setMsg("Could not load the fee quote. Please try again.")
      return false
    } finally {
      if (seq === quoteSeq.current) setQuoting(false)
    }
  }

  /** Quote entry point: re-verifies authorization from the database before asking for a quote. */
  const onQuote = async (): Promise<boolean> => {
    if (quoting || authorizing) return false
    const active = auth?.authorizationActive === true ? await loadAuth() : false
    if (!active) {
      setMsg("Authorize your Pi wallet first. No quote was requested.")
      return false
    }
    return runQuote()
  }

  const onAuthorize = async (): Promise<boolean> => {
    if (authorizing) return false
    if (!consentChecked) {
      setConsentError({ message: "Tick the consent box to allow GreenHaven to send Pi to your linked Pi wallet.", retryable: true })
      return false
    }
    setAuthorizing(true)
    setMsg(null)
    setConsentError(null)
    try {
      const result = await requestPiWalletConsent()
      if (!result.ok) {
        setConsentError({ message: result.message, retryable: result.retryable })
        await loadAuth()
        return false
      }
      setAuth({
        authorizationActive: true,
        mappedUsername: result.status.mappedUsername || destination,
        hasMapping: true,
        piAppUid: result.status.authorizedPiAppUid || null,
        uidMatches: result.status.uidMatchesAuthorization === true,
      })
      setConsentDone(true)
      try {
        window.dispatchEvent(new CustomEvent("ghc:toast", {
          detail: { message: "Pi wallet authorized for withdrawals", type: "success" },
        }))
      } catch { /* */ }
      return true
    } finally {
      setAuthorizing(false)
    }
  }

  /** Authorize, then continue straight to the quote — no reopening or repeating. */
  const onAuthorizeAndContinue = async () => {
    const ok = await onAuthorize()
    if (ok) await runQuote()
  }

  const onSubmit = async () => {
    if (submitting) return
    if (needsConsent || auth?.authorizationActive !== true) {
      setMsg("Authorize your Pi wallet first. No withdrawal was started.")
      return
    }
    // Final confirmation always follows a fresh server quote for this exact amount.
    if (!quote || quote.amountAtomic !== floorToAtomic(amountPi)) {
      const quoted = await onQuote()
      if (quoted) setMsg("Review the amounts above, enter your PIN, then confirm the withdrawal.")
      return
    }
    if (!/^\d{6}$/.test(pinInput)) {
      setMsg("Enter your 6-digit withdrawal PIN.")
      return
    }
    if (amountPi <= 0 || floorToAtomic(amountPi) <= 0) {
      setMsg("Enter a valid amount.")
      return
    }
    // The idempotency key is created BEFORE PIN verification: the server binds the PIN proof to it.
    const preAtomic = floorToAtomic(amountPi)
    let pinIntent = intentRef.current
    if (!pinIntent || pinIntent.amountAtomic !== preAtomic) {
      const nonce =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      pinIntent = { amountAtomic: preAtomic, key: `sheet-payout:${nonce}` }
      intentRef.current = pinIntent
    }
    let pinProof = ""
    setPinBusy(true)
    try {
      if (pinConfigured === false) {
        // PINs are created once in Wallet → Security & PIN, never in the middle of a transaction.
        setMsg("Set up your withdrawal PIN in Security & PIN first, then return to withdraw.")
        return
      }
      {
        const vRes = await fetch("/api/identity/withdrawal-pin", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", pin: pinInput, bindKey: pinIntent.key }),
          cache: "no-store",
        })
        const vBody = (await vRes.json().catch(() => null)) as { ok?: boolean; error?: string; pinProof?: string } | null
        if (!vRes.ok || !vBody?.ok) {
          setMsg(
            vBody?.error === "PIN_LOCKED"
              ? "PIN locked after too many attempts. Try again later."
              : vBody?.error === "PIN_COOLDOWN"
                ? "Withdrawals are paused for 24 hours after a PIN reset, for your protection."
              : vBody?.error === "PIN_INVALID"
                ? "Incorrect withdrawal PIN."
              : vBody?.error === "PIN_NOT_CONFIGURED"
                ? "No withdrawal PIN is set yet. Create one in Security & PIN."
              : vBody?.error === "PIN_PROOF_SECRET_MISSING"
                ? "Withdrawals are temporarily unavailable: the server's PIN signing key is not configured. Your PIN was correct and your funds are unchanged. (ref: PIN_PROOF_SECRET_MISSING)"
              : vRes.status === 429 || vBody?.error === "RATE_LIMITED"
                ? "Too many attempts. Wait a minute and try again."
              : vRes.status === 401 && vBody?.error === "AUTH_REQUIRED"
                ? "Your session expired. Sign in again."
                : `PIN verification is temporarily unavailable. Nothing was changed; try again shortly.${vBody?.error ? ` (ref: ${vBody.error})` : ""}`,
          )
          return
        }
        pinProof = String(vBody?.pinProof || "")
        // The PIN has done its job: never keep it on screen or in memory beyond verification.
        setPinInput("")
        setShowPin(false)
      }
    } finally {
      setPinBusy(false)
    }
    if (amountPi <= 0) {
      setMsg("Enter a valid amount.")
      return
    }
    const amountAtomic = floorToAtomic(amountPi)
    if (amountAtomic <= 0) {
      setMsg("Amount too small.")
      return
    }
    setSubmitting(true)
    setMsg(null)
    try {
      let intent = intentRef.current
      if (!intent || intent.amountAtomic !== amountAtomic) {
        const nonce =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
        intent = { amountAtomic, key: `sheet-payout:${nonce}` }
        intentRef.current = intent
      }
      const res = await apiRequest<{
        ok?: boolean
        error?: string
        message?: string
        requestId?: string
        status?: string
      }>("/api/economy/earnings/withdrawals", {
        method: "POST",
        body: { amountAtomic, idempotencyKey: intent.key, pinProof },
        timeoutMs: 25_000,
      })
      const body = res.data
      if (!res.ok || !body?.ok) {
        const code = body?.error || res.code || ""
        if (code === "WALLET_AUTHORIZATION_REQUIRED") {
          setConsentDone(false)
          await loadAuth()
          setMsg("Your wallet authorization is no longer active. Please authorize again.")
        } else if (code === "PIN_PROOF_REQUIRED") {
          setMsg("Please re-enter your withdrawal PIN to confirm this request.")
        } else if (code === "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED") {
          setMsg("Withdrawal requests are not enabled on this deployment yet. No transfer started.")
        } else {
          setMsg(humanizeApiError(code, body?.message))
        }
        return
      }
      intentRef.current = null
      setPinInput("")
      setShowPin(false)
      let finalMsg =
        "Withdrawal request accepted. Your Pi is reserved while the payout is processed."
      if (body.requestId) {
        setMsg("Request accepted. Sending your Pi…")
        const run = await apiRequest<{ ok?: boolean; status?: string; error?: string; retryable?: boolean }>(
          "/api/economy/earnings/withdrawals/process",
          { method: "POST", body: { requestId: body.requestId }, timeoutMs: 90_000 },
        )
        const r = run.data
        if (r?.ok && r.status === "paid") {
          finalMsg = "Withdrawal complete. Your Pi has been sent to your wallet."
        } else if (r?.ok && r.status === "released") {
          finalMsg = "The payout was cancelled and your Pi was returned to your available balance."
        } else if (r?.error === "PI_EARNINGS_AUTO_EXECUTE_DISABLED") {
          finalMsg = "Request accepted. Automatic payout is not switched on for this deployment yet, so your Pi stays reserved."
        } else if (r?.error === "PI_SERVER_CREDENTIALS_MISSING") {
          finalMsg = "Request accepted, but the payout wallet is not configured yet. Your Pi stays reserved; use \"Check for releasable requests\" to return it."
        } else {
          finalMsg = "Request accepted. The payout is still being confirmed; your Pi stays reserved until Pi confirms the result."
        }
      }
      setMsg(finalMsg)
      try {
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: { message: "Pi withdrawal request submitted", type: "success" },
          }),
        )
      } catch { /* */ }
      onCompleted?.()
    } catch {
      setMsg("Network error. No transfer was started.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[240] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Withdraw Pi"
      data-pi-withdraw-sheet
      data-phase4-withdraw-stable="1"
      onClick={(e) => {
        // Only backdrop closes; never close when interacting with the sheet (keyboard, inputs).
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        className="relative z-[1] flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white">
              π
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Withdraw Pi</p>
              <p className="text-[11px] text-muted-foreground">
                {destination ? `To @${destination}` : "Linked Pi wallet"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close withdraw"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Amount</span>
              <button
                type="button"
                className="font-semibold text-violet-700 dark:text-violet-300"
                onClick={() => {
                  amountTouchedRef.current = true
                  setAmountStr(maxPi > 0 ? atomicToPiString(floorToAtomic(maxPi)) : "")
                }}
                aria-label={`Use maximum available ${formatPi(maxPi)} Pi`}
              >
                Max · {formatPi(maxPi)} π
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={amountStr}
              onChange={(e) => {
                amountTouchedRef.current = true
                // Allow only digits and one decimal point — avoid mobile form quirks from type=number.
                const raw = e.target.value.replace(/[^\d.]/g, "")
                const parts = raw.split(".")
                const cleaned =
                  parts.length <= 1 ? raw : `${parts[0]}.${parts.slice(1).join("").slice(0, 7)}`
                setAmountStr(cleaned)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault()
              }}
              className="mt-1.5 w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-lg font-bold tabular-nums text-foreground outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              placeholder="0.00"
              aria-label="Withdrawal amount in Pi"
              aria-invalid={amountError || overBalance ? true : undefined}
            />
            {amountError || overBalance ? (
              <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400" role="alert">
                {amountError ?? `You can withdraw up to ${formatPi(maxPi)} π. The amount will be capped.`}
              </p>
            ) : null}
          </div>

          {(feePreview || quote) && (
            <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 text-[12px]">
              <p className="font-semibold text-foreground" title="Fee estimate only. Funds are reserved only after you confirm with your PIN.">Review</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p className="flex justify-between">
                  <span>Gross</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatPi(quote?.gross ?? feePreview!.gross)} π
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Fee (3%)</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatPi(quote?.fee ?? feePreview!.fee)} π
                  </span>
                </p>
                <p className="flex justify-between border-t border-border/40 pt-1">
                  <span>You receive</span>
                  <span className="font-bold tabular-nums text-violet-700 dark:text-violet-300">
                    {formatPi(quote?.net ?? feePreview!.net)} π
                  </span>
                </p>
                <p className="pt-1 text-[11px]">
                  Destination: @
                  {quote?.recipientUsername || destination || "linked Pi wallet"} (from your Pi sign-in)
                </p>
              </div>
            </div>
          )}

          {authLoading ? (
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking payout consent…
            </p>
          ) : needsConsent ? (
            <>
          {/* Identity map: GreenHaven account vs linked Pi wallet */}
          <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs text-violet-900 space-y-1" role="group" aria-label="Withdrawal identity details">
            <p className="font-medium text-violet-950">Identity for this withdrawal</p>
            <p>GreenHaven session: signed-in account (server verified)</p>
            <p>
              Linked Pi username:{" "}
              <span className="font-medium">@{destination || "not linked yet"}</span>
              {auth?.hasMapping === false ? " — mapping required before authorization" : ""}
            </p>
            {auth?.piAppUid ? (
              <p className="font-mono text-[10px] text-violet-800/80 break-all">
                Pi app UID (linked): {String(auth.piAppUid).slice(0, 8)}…{String(auth.piAppUid).slice(-4)}
              </p>
            ) : null}
            <p>
              Authorization:{" "}
              {authLoading
                ? "checking…"
                : auth?.authorizationActive
                  ? "active for this linked identity"
                  : "not active — complete consent below"}
            </p>
            <p className="text-violet-800/90">
              Payouts only go to the KYC-approved Pi wallet bound to this linked identity. GreenHaven never asks for a raw wallet address in this sheet.
            </p>
          </div>

<div className="rounded-2xl border border-violet-300/70 bg-violet-50/90 px-3 py-3 dark:border-violet-800 dark:bg-violet-950/40" data-wallet-consent-dialog aria-busy={authorizing}>
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-violet-950 dark:text-violet-100">
                <ShieldCheck className="h-4 w-4" /> Authorize your Pi wallet for withdrawals
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-violet-900/90 dark:text-violet-100/85">
                GreenHaven needs your explicit Pi authentication and consent to send Pi earnings to the wallet linked to your account
                {destination ? ` (@${destination})` : ""}. You will be asked to confirm with Pi. Only your linked Pi identity can be authorized.
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-violet-900/90 dark:text-violet-100/85">
                A 3% platform fee applies to each withdrawal; you receive the remaining 97%.
              </p>
              <label className="mt-2.5 flex items-start gap-2 text-[12px] text-violet-950 dark:text-violet-100">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-violet-400"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                />
                <span>
                  I authorize GreenHaven to send eligible Pi earnings to my linked Pi wallet
                  {destination ? ` (@${destination})` : ""}.
                </span>
              </label>
              {consentError ? (
                <p className="mt-2 rounded-lg bg-amber-100/80 px-2.5 py-1.5 text-[11px] font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-100" role="alert">
                  {consentError.message}
                </p>
              ) : null}
              <button
                type="button"
                disabled={authorizing || authLoading || !consentChecked || auth?.hasMapping !== true}
                aria-busy={authorizing}
                onClick={() => void onAuthorizeAndContinue()}
                className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full bg-violet-700 px-4 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {authorizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Waiting for Pi…
                  </>
                ) : consentError?.retryable ? (
                  "Retry Pi authentication"
                ) : (
                  "Authorize & continue"
                )}
              </button>
              {auth?.hasMapping !== true ? (
                <p className="mt-2 text-[11px] text-violet-900/90 dark:text-violet-100/85">
                  Sign in with Pi first so GreenHaven can link your Pi identity.
                </p>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                disabled={authorizing}
                className="mt-2 flex min-h-10 w-full items-center justify-center rounded-full text-[12px] font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:text-violet-100 dark:hover:bg-violet-900/40"
              >
                Cancel
              </button>
            </div>
            </>
          ) : (
            <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <Wallet className="h-3.5 w-3.5" /> {consentDone ? "Wallet authorized. " : ""}Payouts authorized for @{destination || "your Pi wallet"}
            </p>
          )}

          {!needsConsent && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                Withdrawal PIN (6 digits — separate from login; never sent to Pi)
              </p>
              {pinStatusError ? (
                <p id="withdraw-pin-status-error" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="alert">{pinStatusError}</p>
              ) : null}
              {pinConfigured === false ? (
                <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3 text-[12px] text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100" role="status">
                  <p className="font-semibold">Set up your withdrawal PIN first</p>
                  <p className="text-[11px] leading-relaxed">Your PIN is created once in Wallet → Security &amp; PIN, not during a withdrawal. Then come back and enter it here.</p>
                  {onSetupPin ? (
                    <button type="button" onClick={onSetupPin} className="min-h-10 w-full rounded-full bg-violet-700 px-4 text-[12px] font-bold text-white">Go to Security &amp; PIN</button>
                  ) : null}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-2xl border border-border/70 bg-background py-2.5 pl-4 pr-12 text-sm font-semibold tracking-[0.3em] text-foreground outline-none focus:border-violet-500"
                    placeholder="••••••"
                    aria-label="Enter withdrawal PIN"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    aria-describedby={pinStatusError ? "withdraw-pin-status-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted active:scale-95"
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                    aria-pressed={showPin}
                  >
                    {showPin ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              )}
              {pinConfigured === true ? (
                <PinRecoveryPanel onPinReset={() => { setPinInput(""); setMsg("PIN reset. Enter your new PIN to continue.") }} />
              ) : null}
            </div>
          )}

          {msg ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status">
              {msg}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border/50 px-4 py-3">
          <button
            type="button"
            disabled={quoting || authLoading || authorizing || needsConsent || auth === null || amountPi <= 0}
            aria-busy={quoting}
            onClick={() => void onQuote()}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-border/70 bg-background text-[13px] font-bold text-foreground disabled:opacity-50"
          >
            {quoting ? "Quoting…" : needsConsent ? "Authorize to preview fee" : "Preview fee"}
          </button>
          <button
            type="button"
            disabled={submitting || quoting || authLoading || authorizing || pinBusy || needsConsent || auth === null || pinConfigured === null || amountPi <= 0}
            aria-busy={submitting || pinBusy}
            onClick={() => void onSubmit()}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-violet-700 text-[15px] font-bold text-white shadow-sm disabled:opacity-50"
            data-testid="pi-withdraw-submit"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : needsConsent ? (
              "Authorize first"
            ) : quote && quote.amountAtomic === floorToAtomic(amountPi) ? (
              "Confirm withdrawal"
            ) : (
              "Review withdrawal"
            )}
          </button>
          <p className="text-center text-[10px] text-muted-foreground" aria-live="polite">
            Your Pi is reserved first, then sent by the secure payout service. Success is shown only after Pi confirms it.
          </p>
        </div>
      </div>
    </div>
  )
}
