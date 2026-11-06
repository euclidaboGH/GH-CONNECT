"use client"

/**
 * Exchange-style Pi withdrawal sheet.
 * Flow: wallet authorization check → (if missing) genuine Pi consent → quote → review → PIN → submit.
 * The quote is NEVER requested until the server confirms an active authorization whose Pi UID
 * matches the linked identity. Consent uses Pi.authenticate + server-side verification
 * (lib/client/pi-wallet-consent.ts); the browser never supplies a UID or an "authorized" flag.
 * Never invents paid results; A2U execution remains Testnet-flag and worker dependent.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, ShieldCheck, X, Wallet } from "lucide-react"
import { apiRequest } from "@/lib/client/api-request"
import { userFacingError } from "@/lib/ux/user-facing-errors"
import { fetchWalletAuthorizationStatus, requestPiWalletConsent } from "@/lib/client/pi-wallet-consent"

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
}

type AuthSnap = {
  authorizationActive: boolean
  mappedUsername: string | null
  hasMapping: boolean
}

const PI_SCALE = 10_000_000

function floorToAtomic(pi: number): number {
  return Math.floor(pi * PI_SCALE + 1e-12)
}

function atomicToPi(atomic: number): number {
  return atomic / PI_SCALE
}

function formatPi(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })
}

export function PiWithdrawSheet({ open, onClose, availablePi, linkedUsername, onCompleted }: Props) {
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
  const [pinInput, setPinInput] = useState("")
  const [pinConfirm, setPinConfirm] = useState("")
  const [pinBusy, setPinBusy] = useState(false)

  const maxPi = typeof availablePi === "number" && Number.isFinite(availablePi) ? Math.max(0, availablePi) : 0
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
      // Database-backed status; a browser flag is never trusted.
      const res = await fetchWalletAuthorizationStatus()
      if (res.ok) {
        const active = res.status.authorizationActive === true && res.status.uidMatchesAuthorization === true
        setAuth({
          authorizationActive: active,
          mappedUsername: res.status.mappedUsername || linkedUsername || null,
          hasMapping: res.status.hasMapping,
        })
        return active
      }
      setAuth({ authorizationActive: false, mappedUsername: linkedUsername || null, hasMapping: false })
      return false
    } catch {
      setAuth({ authorizationActive: false, mappedUsername: linkedUsername || null, hasMapping: false })
      return false
    } finally {
      setAuthLoading(false)
    }
  }, [linkedUsername])
  loadAuthRef.current = loadAuth

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
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
    setPinConfirm("")
    quoteSeq.current += 1
    intentRef.current = null
    const openingBalance = latestMaxPiRef.current
    setAmountStr(openingBalance > 0 ? String(Number(openingBalance.toFixed(7))) : "")
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
        const body = (await res.json().catch(() => null)) as { configured?: boolean } | null
        if (res.ok) setPinConfigured(body?.configured === true)
        else setPinConfigured(false)
      } catch {
        if (sessionAtOpen === sessionIdRef.current) setPinConfigured(false)
      }
    })()
  }, [open])

  // When balance hydrates after open and user has not typed yet, seed Available once.
  useEffect(() => {
    if (!open || amountTouchedRef.current) return
    if (maxPi > 0 && (!amountStr || amountStr === "0" || amountStr === "0.00")) {
      setAmountStr(String(Number(maxPi.toFixed(7))))
    }
  }, [open, maxPi, amountStr])

  const amountPi = useMemo(() => {
    const n = Number(amountStr)
    if (!Number.isFinite(n) || n <= 0) return 0
    // Do not clamp typed amount to a still-hydrating maxPi (0) — that zeros the field while typing.
    if (maxPi > 0) return Math.min(n, maxPi)
    return n
  }, [amountStr, maxPi])

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
    setPinBusy(true)
    try {
      if (pinConfigured === false) {
        if (pinInput !== pinConfirm) {
          setMsg("PIN and confirmation do not match.")
          return
        }
        const setRes = await fetch("/api/identity/withdrawal-pin", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set", pin: pinInput, confirmPin: pinConfirm }),
          cache: "no-store",
        })
        const setBody = (await setRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!setRes.ok || !setBody?.ok) {
          setMsg(setBody?.error === "PIN_TABLE_PENDING" || setBody?.error === "PIN_PERSIST_FAILED"
            ? "PIN storage is not ready on the database yet. Operator must apply the withdrawal PIN migration."
            : "Could not save withdrawal PIN.")
          return
        }
        setPinConfigured(true)
      } else {
        const vRes = await fetch("/api/identity/withdrawal-pin", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", pin: pinInput }),
          cache: "no-store",
        })
        const vBody = (await vRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!vRes.ok || !vBody?.ok) {
          setMsg(
            vBody?.error === "PIN_LOCKED"
              ? "PIN locked after too many attempts. Try again later."
              : vBody?.error === "PIN_INVALID"
                ? "Incorrect withdrawal PIN."
                : "PIN verification failed.",
          )
          return
        }
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
        body: { amountAtomic, idempotencyKey: intent.key },
        timeoutMs: 25_000,
      })
      const body = res.data
      if (!res.ok || !body?.ok) {
        const code = body?.error || res.code || ""
        if (code === "WALLET_AUTHORIZATION_REQUIRED") {
          setConsentDone(false)
          await loadAuth()
          setMsg("Your wallet authorization is no longer active. Please authorize again.")
        } else if (code === "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED") {
          setMsg("Withdrawal requests are not enabled on this deployment yet. No transfer started.")
        } else {
          setMsg(humanizeApiError(code, body?.message))
        }
        return
      }
      intentRef.current = null
      setMsg(
        body.status
          ? `Request accepted (${body.status}). Server worker settles on Testnet when funded — this app never invents a paid result.`
          : "Withdrawal request accepted. Settlement runs on the server when Testnet A2U is enabled and funded.",
      )
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
                onClick={() => setAmountStr(maxPi > 0 ? String(Number(maxPi.toFixed(7))) : "")}
              >
                Available {formatPi(maxPi)} π
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
            />
          </div>

          {(feePreview || quote) && (
            <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 text-[12px]">
              <p className="font-semibold text-foreground">Review</p>
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
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking payout consent…
            </p>
          ) : needsConsent ? (
            <div className="rounded-2xl border border-violet-300/70 bg-violet-50/90 px-3 py-3 dark:border-violet-800 dark:bg-violet-950/40" data-wallet-consent-dialog>
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
                disabled={authorizing || !consentChecked || auth?.hasMapping !== true}
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
              {pinConfigured === false ? (
                <>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="new-password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-sm font-semibold tracking-[0.3em] text-foreground outline-none focus:border-violet-500"
                    placeholder="Set 6-digit PIN"
                    aria-label="Create withdrawal PIN"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="new-password"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-sm font-semibold tracking-[0.3em] text-foreground outline-none focus:border-violet-500"
                    placeholder="Confirm PIN"
                    aria-label="Confirm withdrawal PIN"
                  />
                </>
              ) : (
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-sm font-semibold tracking-[0.3em] text-foreground outline-none focus:border-violet-500"
                  placeholder="••••••"
                  aria-label="Enter withdrawal PIN"
                />
              )}
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
            onClick={() => void onQuote()}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-border/70 bg-background text-[13px] font-bold text-foreground disabled:opacity-50"
          >
            {quoting ? "Quoting…" : needsConsent ? "Authorize to preview fee" : "Preview fee"}
          </button>
          <button
            type="button"
            disabled={submitting || quoting || authLoading || authorizing || pinBusy || needsConsent || auth === null || amountPi <= 0}
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
          <p className="text-center text-[10px] text-muted-foreground">
            Request only — server A2U worker pays when Testnet is enabled and funded. No fabricated success.
          </p>
        </div>
      </div>
    </div>
  )
}
