"use client"

/**
 * Passkeys management panel (Phase 7).
 * Optional additive security — does not replace Pi auth or App Lock PIN.
 */

import { useCallback, useEffect, useState } from "react"
import { Fingerprint, Loader2 } from "lucide-react"
import {
  authenticatePasskeyStepUp,
  browserSupportsWebAuthn,
  registerPasskey,
} from "@/lib/auth/webauthn-client"

type Cred = {
  id: string
  label: string
  deviceType: string | null
  backedUp: boolean
  createdAt: number
  lastUsedAt: number | null
}

export function PasskeysPanel() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [creds, setCreds] = useState<Cred[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/webauthn/credentials", {
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) setCreds(data.credentials || [])
      else setCreds([])
    } catch {
      setCreds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void browserSupportsWebAuthn().then(setSupported)
    void load()
  }, [load])

  const onRegister = async () => {
    setBusy(true)
    setMessage(null)
    const label = window.prompt("Label for this passkey (optional)") || undefined
    const r = await registerPasskey(label)
    setBusy(false)
    if (!r.ok) {
      setMessage(
        r.error === "STEP_UP_REQUIRED"
          ? "Confirm with Pi first, then register a passkey."
          : r.error || "Registration failed"
      )
      return
    }
    setMessage("Passkey registered.")
    await load()
  }

  const onStepUp = async () => {
    setBusy(true)
    setMessage(null)
    const r = await authenticatePasskeyStepUp()
    setBusy(false)
    if (!r.ok) {
      setMessage(r.error || "Passkey authentication failed")
      return
    }
    setMessage("Passkey verified — sensitive actions allowed for a short time.")
  }

  const onRevoke = async (id: string) => {
    if (!window.confirm("Revoke this passkey? It can no longer be used.")) return
    setBusy(true)
    try {
      const res = await fetch("/api/auth/webauthn/credentials", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setMessage(data.error || "Revoke failed")
      } else {
        setMessage("Passkey revoked.")
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-muted-foreground" />
        <p className="text-[14px] font-bold">Passkeys</p>
      </div>
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        Optional device passkeys for re-authentication and step-up. Pi Network remains your primary
        account identity. Passkeys do not replace App Lock PIN or Pi Wallet payment approval.
        Requires HTTPS and a compatible browser — Pi Browser support may be limited.
      </p>

      {supported === false ? (
        <p className="text-[13px] text-amber-600">
          This browser does not support WebAuthn/passkeys or is not a secure context.
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : creds.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No passkeys registered.</p>
      ) : (
        <ul className="space-y-2">
          {creds.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
            >
              <div>
                <p className="text-[13px] font-semibold">{c.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  Added {new Date(c.createdAt).toLocaleDateString()}
                  {c.lastUsedAt
                    ? ` · Last used ${new Date(c.lastUsedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRevoke(c.id)}
                className="rounded-full border border-border px-3 py-1 text-[12px] font-semibold"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy || supported === false}
          onClick={() => void onRegister()}
          className="w-full rounded-full bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
        >
          Register passkey
        </button>
        {creds.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onStepUp()}
            className="w-full rounded-full border border-border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
          >
            Verify passkey (step-up)
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="text-[12px] text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
