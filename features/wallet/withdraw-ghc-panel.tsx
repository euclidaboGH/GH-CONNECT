"use client"

/**
 * GHC → Pi withdrawal request UI (platform settlement — not instant Pi send).
 * Rate: server REFERENCE_GHC_PER_PI (100 GHC per 1 π by default). 100 GHC ≠ 100 π.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { IdentityService } from "@/lib/identity/identity-service"

function newWithdrawalIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `wd_${crypto.randomUUID()}`
    }
  } catch {
    /* */
  }
  return `wd_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

type Quote = {
  ghcPerPi: number
  minPi: number
  minGhc: number
  ledgerBalance: number
  lockedGhc: number
  withdrawableGhc: number
  piEquivalent: number
  eligible: boolean
  note?: string
}

type WdRequest = {
  id: string
  ghcAmount: number
  ghcPerPi: number
  piAmount: number
  piWalletAddress: string
  status: string
  createdAt: string
  settlementRef?: string | null
}

function maskWallet(addr: string): string {
  const a = String(addr || "")
  if (a.length <= 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function WithdrawGhcPanel() {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<WdRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [ghcAmount, setGhcAmount] = useState("")
  const [wallet, setWallet] = useState("")
  const [confirmWallet, setConfirmWallet] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  /** Stable across retries of the same submit; rotated only after success */
  const idempotencyKeyRef = useRef(newWithdrawalIdempotencyKey())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/economy/withdrawals", {
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...IdentityService.getAuthHeaders(),
        },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setError(data.error || "Could not load withdrawal info")
        setQuote(null)
        setItems([])
        return
      }
      setQuote(data.quote || null)
      setItems(Array.isArray(data.withdrawals) ? data.withdrawals : [])
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rate = quote?.ghcPerPi ?? 100
  const amountNum = Number(ghcAmount)
  const piPreview =
    Number.isFinite(amountNum) && amountNum > 0 ? Math.round((amountNum / rate) * 1e8) / 1e8 : 0

  const submit = async () => {
    if (!quote?.eligible) return
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a valid GHC amount")
      return
    }
    if (amountNum < quote.minGhc) {
      setError(`Minimum is ${quote.minGhc} GHC (100 π equivalent at ${rate} GHC/π)`)
      return
    }
    if (!wallet.trim() || wallet.trim().length < 8) {
      setError("Enter a valid Pi wallet address")
      return
    }
    if (!confirmWallet) {
      setError("Confirm the Pi wallet address")
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/economy/withdrawals", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...IdentityService.getAuthHeaders(),
        },
        body: JSON.stringify({
          ghcAmount: amountNum,
          piWalletAddress: wallet.trim(),
          idempotencyKey: idempotencyKeyRef.current,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setError(data.message || data.error || "Request failed")
        return
      }
      // New key only after accepted request so double-click / retry stays idempotent
      idempotencyKeyRef.current = newWithdrawalIdempotencyKey()
      setSuccess(
        data.message ||
          "Withdrawal request created. Pi is not sent instantly — GreenHaven will process settlement."
      )
      setGhcAmount("")
      setConfirmWallet(false)
      await load()
    } catch {
      setError("Network error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="rounded-2xl border border-border/50 bg-card/80 p-3 space-y-3"
      aria-label="Withdraw GHC"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Withdraw GHC</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
            Request Pi settlement of eligible GHC. Not an instant transfer. Rate is{" "}
            <strong className="text-foreground">{rate} GHC per 1 π</strong> (not 1:1).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-[12px] text-muted-foreground">Loading…</p>
      ) : quote ? (
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-xl bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Withdrawable</p>
            <p className="font-semibold tabular-nums">{quote.withdrawableGhc.toFixed(2)} GHC</p>
          </div>
          <div className="rounded-xl bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">≈ Pi value</p>
            <p className="font-semibold tabular-nums">{quote.piEquivalent.toFixed(4)} π</p>
          </div>
          <div className="rounded-xl bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Locked</p>
            <p className="font-semibold tabular-nums">{quote.lockedGhc.toFixed(2)} GHC</p>
          </div>
          <div className="rounded-xl bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Min (100 π)</p>
            <p className="font-semibold tabular-nums">{quote.minGhc.toFixed(0)} GHC</p>
          </div>
        </div>
      ) : null}

      {quote && !quote.eligible ? (
        <p className="text-[12px] text-amber-800 dark:text-amber-200/90 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
          Withdrawal unlocks at {quote.minGhc} GHC minimum (100 π equivalent at {rate} GHC/π).
        </p>
      ) : null}

      {quote?.eligible ? (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <label className="block text-[11px] font-medium text-muted-foreground">
            GHC amount
            <input
              type="number"
              min={quote.minGhc}
              step="0.01"
              value={ghcAmount}
              onChange={(e) => setGhcAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            You would receive ≈ <span className="font-semibold text-foreground">{piPreview} π</span>{" "}
            at frozen rate {rate} GHC/π
          </p>
          <label className="block text-[11px] font-medium text-muted-foreground">
            Pi Network wallet address
            <input
              type="text"
              value={wallet}
              onChange={(e) => {
                setWallet(e.target.value)
                setConfirmWallet(false)
              }}
              className="mt-1 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Paste Pi wallet address"
              autoComplete="off"
            />
          </label>
          <label className="flex items-start gap-2 text-[12px] text-foreground">
            <input
              type="checkbox"
              checked={confirmWallet}
              onChange={(e) => setConfirmWallet(e.target.checked)}
              className="mt-0.5"
            />
            I confirm this Pi address is correct. Pi is not sent instantly.
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full min-h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit withdrawal request"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-[12px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-[12px] text-emerald-700 dark:text-emerald-300" role="status">
          {success}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-1.5 border-t border-border/40 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Withdrawal history
          </p>
          <ul className="space-y-1.5">
            {items.slice(0, 8).map((w) => (
              <li
                key={w.id}
                className="rounded-xl border border-border/40 px-2.5 py-2 text-[12px]"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium tabular-nums">
                    {Number(w.ghcAmount).toFixed(2)} GHC → {Number(w.piAmount).toFixed(4)} π
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">{w.status}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  @{maskWallet(w.piWalletAddress)} · rate {Number(w.ghcPerPi)} GHC/π
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
