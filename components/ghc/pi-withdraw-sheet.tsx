"use client"

/**
 * Exchange-style Pi withdrawal sheet.
 * Flow: amount → fee/destination review → (first time) explicit payout consent → submit request.
 * Consent still hits POST /api/identity/wallet-authorization; payouts stay server-gated.
 * Never invents paid results; A2U execution remains Testnet-flag and worker dependent.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, ShieldCheck, X, Wallet } from "lucide-react"
import { apiRequest } from "@/lib/client/api-request"
import { userFacingError } from "@/lib/ux/user-facing-errors"

function humanizeApiError(code?: string | null, message?: string | null): string {
  if (message && !/^[A-Z][A-Z0-9_]{3,}$/.test(message.trim())) return message
  const c = (code || "").toUpperCase()
  if (c === "WALLET_AUTHORIZATION_REQUIRED") {
    return "Authorize Pi payouts once in this sheet, then submit again."
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
  const [authLoading, setAuthLoading] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [quote, setQuote] = useState<{
    gross: number
    fee: number
    net: number
    recipientUsername?: string | null
  } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [confirmCode, setConfirmCode] = useState("")
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [pinConfirm, setPinConfirm] = useState("")
  const [pinBusy, setPinBusy] = useState(false)

  const maxPi = typeof availablePi === "number" && Number.isFinite(availablePi) ? Math.max(0, availablePi) : 0

  const loadAuth = useCallback(async () => {
    setAuthLoading(true)
    try {
      const res = await fetch("/api/identity/wallet-authorization", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        authorizationActive?: boolean
        uidMatchesAuthorization?: boolean
        mappedUsername?: string | null
        hasMapping?: boolean
        error?: string
      } | null
      if (res.ok && body?.ok) {
        setAuth({
          authorizationActive:
            body.authorizationActive === true && body.uidMatchesAuthorization === true,
          mappedUsername: body.mappedUsername || linkedUsername || null,
          hasMapping: body.hasMapping === true,
        })
      } else {
        setAuth({
          authorizationActive: false,
          mappedUsername: linkedUsername || null,
          hasMapping: false,
        })
      }
    } catch {
      setAuth({
        authorizationActive: false,
        mappedUsername: linkedUsername || null,
        hasMapping: false,
      })
    } finally {
      setAuthLoading(false)
    }
  }, [linkedUsername])

  useEffect(() => {
    if (!open) return
    setMsg(null)
    setQuote(null)
    setConsentChecked(false)
    setConfirmCode("")
    setAmountStr(maxPi > 0 ? String(Number(maxPi.toFixed(7))) : "")
    void loadAuth()
    ;(async () => {
      try {
        const res = await fetch("/api/identity/withdrawal-pin", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        const body = (await res.json().catch(() => null)) as { configured?: boolean } | null
        if (res.ok) setPinConfigured(body?.configured === true)
        else setPinConfigured(false)
      } catch {
        setPinConfigured(false)
      }
    })()
  }, [open, maxPi, loadAuth])

  const amountPi = useMemo(() => {
    const n = Number(amountStr)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.min(n, maxPi || n)
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

  const destination = auth?.mappedUsername || linkedUsername || null
  const needsConsent = auth !== null && auth.authorizationActive !== true
  const expectedConfirm = (destination || "PI").slice(0, 4).toUpperCase()

  const onAuthorize = async (): Promise<boolean> => {
    if (authorizing) return false
    if (!consentChecked) {
      setMsg("Tick the consent box to allow GreenHaven to send Testnet Pi to your linked Pi wallet.")
      return false
    }
    setAuthorizing(true)
    setMsg(null)
    try {
      const res = await fetch("/api/identity/wallet-authorization", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        message?: string
        authorizationActive?: boolean
        uidMatchesAuthorization?: boolean
      } | null
      if (!res.ok || !body?.ok) {
        setMsg(humanizeApiError(body?.error, body?.message || `Authorization failed (HTTP ${res.status})`))
        return false
      }
      const verify = await fetch("/api/identity/wallet-authorization", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const vBody = (await verify.json().catch(() => null)) as {
        ok?: boolean
        authorizationActive?: boolean
        uidMatchesAuthorization?: boolean
        mappedUsername?: string | null
        hasMapping?: boolean
      } | null
      if (
        !verify.ok ||
        !vBody?.ok ||
        vBody.authorizationActive !== true ||
        vBody.uidMatchesAuthorization !== true
      ) {
        setMsg("Consent was sent but the server could not confirm an active authorization yet. Try again.")
        await loadAuth()
        return false
      }
      setAuth({
        authorizationActive: true,
        mappedUsername: vBody.mappedUsername || destination,
        hasMapping: true,
      })
      try {
        window.dispatchEvent(new CustomEvent("ghc:wallet-auth-changed", { detail: { active: true } }))
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
        window.dispatchEvent(new CustomEvent("ghc:toast", {
          detail: { message: "Pi payouts authorized for your linked wallet", type: "success" },
        }))
      } catch { /* */ }
      setMsg("Authorized. You can submit the withdrawal next.")
      return true
    } catch {
      setMsg("Network error while authorizing. No transfer started.")
      return false
    } finally {
      setAuthorizing(false)
    }
  }

  const onQuote = async () => {
    if (amountPi <= 0) {
      setMsg("Enter an amount to withdraw.")
      return
    }
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
      }>("/api/economy/earnings/quote", {
        method: "POST",
        body: { amountAtomic },
        timeoutMs: 20_000,
      })
      const body = res.data
      if (!res.ok || !body?.ok) {
        const code = body?.error || res.code || ""
        if (code === "WALLET_AUTHORIZATION_REQUIRED") {
          setAuth((a) => (a ? { ...a, authorizationActive: false } : a))
          setMsg("Authorize payouts below, then review the fee again.")
        } else {
          setMsg(humanizeApiError(code, body?.message))
        }
        return
      }
      const gross =
        typeof body.grossPi === "number"
          ? body.grossPi
          : typeof body.grossAtomic === "number"
            ? atomicToPi(body.grossAtomic)
            : amountPi
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
        gross,
        fee,
        net,
        recipientUsername: body.recipientUsername || destination,
      })
    } catch {
      setMsg("Could not load fee quote. Try again.")
    } finally {
      setQuoting(false)
    }
  }

  const onSubmit = async () => {
    if (submitting) return
    if (needsConsent) {
      setMsg("Authorize payouts first, then submit.")
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
      const nonce =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const res = await apiRequest<{
        ok?: boolean
        error?: string
        message?: string
        requestId?: string
        status?: string
      }>("/api/economy/earnings/withdrawals", {
        method: "POST",
        body: { amountAtomic, idempotencyKey: `sheet-payout:${nonce}` },
        timeoutMs: 25_000,
      })
      const body = res.data
      if (!res.ok || !body?.ok) {
        const code = body?.error || res.code || ""
        if (code === "WALLET_AUTHORIZATION_REQUIRED") {
          setAuth((a) => (a ? { ...a, authorizationActive: false } : a))
          setMsg("Authorize payouts, then submit again.")
        } else if (code === "PI_EARNINGS_PAYOUT_REQUESTS_DISABLED") {
          setMsg("Withdrawal requests are not enabled on this deployment yet. No transfer started.")
        } else {
          setMsg(humanizeApiError(code, body?.message))
        }
        return
      }
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
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl">
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
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
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
            <div className="rounded-2xl border border-violet-300/70 bg-violet-50/90 px-3 py-3 dark:border-violet-800 dark:bg-violet-950/40">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-950 dark:text-violet-100">
                <ShieldCheck className="h-4 w-4" /> One-time payout consent
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-violet-900/90 dark:text-violet-100/85">
                GreenHaven needs your permission once to send App-to-User Pi to the wallet linked at sign-in
                {destination ? ` (@${destination})` : ""}. This is not automatic and is required on Testnet and Mainnet.
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
              <button
                type="button"
                disabled={authorizing || !consentChecked}
                onClick={() => void onAuthorize()}
                className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full bg-violet-700 px-4 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {authorizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authorizing…
                  </>
                ) : (
                  "Authorize & continue"
                )}
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <Wallet className="h-3.5 w-3.5" /> Payouts authorized for @{destination || "your Pi wallet"}
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
            disabled={quoting || amountPi <= 0}
            onClick={() => void onQuote()}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-border/70 bg-background text-[13px] font-bold text-foreground disabled:opacity-50"
          >
            {quoting ? "Quoting…" : "Preview fee"}
          </button>
          <button
            type="button"
            disabled={submitting || authorizing || pinBusy || needsConsent || amountPi <= 0}
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
            ) : (
              "Submit withdrawal"
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
