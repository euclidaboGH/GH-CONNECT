"use client"

/**
 * Explicit Pi A2U payout consent UI.
 * Identity link ≠ payout authorization. Server records consent in gh_pi_wallet_authorizations.
 * Never trusts client-supplied recipient UIDs.
 */
import { useCallback, useEffect, useState } from "react"
import { ShieldCheck, Loader2 } from "lucide-react"
import { confirmDialog } from "@/lib/ui/global-interactions"

type AuthSnap = {
  authorizationActive?: boolean
  hasMapping?: boolean
  mappedUsername?: string | null
  consentedAt?: string | null
  error?: string
}

export function PiPayoutAuthorizationCard({
  compact = false,
  onChanged,
}: {
  compact?: boolean
  onChanged?: (active: boolean) => void
}) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [snap, setSnap] = useState<AuthSnap | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/identity/wallet-authorization", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const body = (await res.json().catch(() => null)) as AuthSnap & { ok?: boolean } | null
      if (res.ok && body?.ok !== false) {
        setSnap(body)
        onChanged?.(body.authorizationActive === true)
      } else {
        setSnap({ error: body?.error || "WALLET_AUTHORIZATION_UNAVAILABLE" })
        onChanged?.(false)
      }
    } catch {
      setSnap({ error: "NETWORK_ERROR" })
      onChanged?.(false)
    } finally {
      setLoading(false)
    }
  }, [onChanged])

  useEffect(() => {
    void refresh()
    const onRefresh = () => void refresh()
    window.addEventListener("ghc:wallet-auth-changed", onRefresh)
    window.addEventListener("ghc:wallet-refresh", onRefresh)
    return () => {
      window.removeEventListener("ghc:wallet-auth-changed", onRefresh)
      window.removeEventListener("ghc:wallet-refresh", onRefresh)
    }
  }, [refresh])

  const grant = async () => {
    if (busy) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/identity/wallet-authorization", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        message?: string
        status?: string
      } | null
      if (!res.ok || !body?.ok) {
        const code = body?.error || ""
        if (code === "IDENTITY_MAPPING_REQUIRED") {
          setMsg("Sign in with Pi so GreenHaven can verify your identity before authorizing payouts.")
        } else if (code === "WALLET_AUTHORIZATION_UNAVAILABLE") {
          setMsg("Payout authorization is temporarily unavailable. Try again later.")
        } else {
          setMsg(body?.message || "Could not record authorization. Please try again.")
        }
        return
      }
      setMsg("Pi payouts authorized. You can withdraw eligible earnings to your linked Pi wallet.")
      try {
        window.dispatchEvent(new CustomEvent("ghc:wallet-auth-changed", { detail: { active: true } }))
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
      } catch { /* */ }
      await refresh()
    } catch {
      setMsg("Network error while authorizing. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (busy) return
    const ok = await confirmDialog({
      title: "Revoke Pi payout authorization?",
      message: "Future withdrawals will be blocked until you authorize again. Already submitted payouts are not reversed.",
      confirmLabel: "Revoke",
      cancelLabel: "Keep authorized",
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/identity/wallet-authorization", {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "user_revoked" }),
        cache: "no-store",
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !body?.ok) {
        setMsg("Could not revoke authorization. Please try again.")
        return
      }
      setMsg("Authorization revoked. Withdrawals are blocked until you authorize again.")
      try {
        window.dispatchEvent(new CustomEvent("ghc:wallet-auth-changed", { detail: { active: false } }))
        window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
        window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
      } catch { /* */ }
      await refresh()
    } catch {
      setMsg("Network error while revoking.")
    } finally {
      setBusy(false)
    }
  }

  const active = snap?.authorizationActive === true
  const linked = snap?.hasMapping === true

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-border/60 bg-card p-3.5 shadow-[var(--gh-card-shadow)]"
          : "rounded-[1.35rem] border border-border/60 bg-card p-4 shadow-[var(--gh-card-shadow)]"
      }
      aria-label="Pi wallet payout authorization"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
          <ShieldCheck size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-foreground">Pi payout authorization</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Linking Pi is not enough. You must explicitly allow GreenHaven to send App-to-User (A2U) payouts to your linked Pi identity.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden /> Checking authorization…
        </p>
      ) : snap?.error === "WALLET_AUTHORIZATION_UNAVAILABLE" ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Authorization service is temporarily unavailable. Withdrawals stay blocked until this recovers.
        </p>
      ) : !linked ? (
        <p className="mt-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
          Sign in with Pi first so your identity can be verified, then authorize payouts here.
        </p>
      ) : active ? (
        <div className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-[12px] font-semibold text-emerald-900 dark:text-emerald-100">
            Active — payouts may go to your linked Pi wallet
            {snap?.mappedUsername ? ` (@${snap.mappedUsername})` : ""}.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void revoke()}
            className="mt-2 text-[12px] font-bold text-emerald-900 underline-offset-2 hover:underline disabled:opacity-50 dark:text-emerald-100"
          >
            {busy ? "Working…" : "Revoke authorization"}
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-[12px] font-semibold text-amber-950 dark:text-amber-100">
            Authorization required before any Pi withdrawal.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void grant()}
            className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-violet-700 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
          >
            {busy ? "Authorizing…" : "Authorize Pi wallet for payouts"}
          </button>
        </div>
      )}

      {msg ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  )
}
