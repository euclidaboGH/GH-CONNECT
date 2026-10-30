"use client"

/**
 * Active Sessions panel (Phase 5).
 * Lists GH server sessions; revoke one or all others.
 * Does not display tokens/hashes. Separate from App Lock.
 */

import { useCallback, useEffect, useState } from "react"
import { Loader2, MonitorSmartphone, Shield } from "lucide-react"

type PublicSession = {
  id: string
  deviceLabel: string
  createdAt: number
  lastSeenAt: number
  expiresAt: number
  absoluteExpiresAt: number
  isCurrent: boolean
  active: boolean
}

function formatWhen(ts: number): string {
  if (!ts) return "—"
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return "—"
  }
}

export function ActiveSessionsPanel() {
  const [sessions, setSessions] = useState<PublicSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/sessions", { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(
          data.error === "SESSION_REQUIRED"
            ? "Sign in with Pi Browser to manage sessions."
            : data.error || "Could not load sessions"
        )
        setSessions([])
        return
      }
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
    } catch {
      setError("Network error loading sessions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const revokeOne = async (id: string, isCurrent: boolean) => {
    const label = isCurrent
      ? "Sign out this device? You will need to sign in with Pi again."
      : "Revoke this session? That device will be signed out."
    if (!window.confirm(label)) return
    setBusyId(id)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/auth/sessions/${encodeURIComponent(id)}/revoke`,
        { method: "POST", credentials: "include" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setMessage(data.error || "Revoke failed")
        return
      }
      if (data.wasCurrent) {
        setMessage("Signed out this device. Reloading…")
        window.setTimeout(() => window.location.reload(), 800)
        return
      }
      setMessage("Session revoked.")
      await load()
    } catch {
      setMessage("Network error")
    } finally {
      setBusyId(null)
    }
  }

  const revokeOthers = async () => {
    if (
      !window.confirm(
        "Sign out all other sessions? You will stay signed in on this device. Recent Pi confirmation may be required."
      )
    ) {
      return
    }
    setBusyId("others")
    setMessage(null)
    try {
      const res = await fetch("/api/auth/sessions/revoke-others", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        if (data.error === "STEP_UP_REQUIRED" || data.error === "SESSION_REQUIRED") {
          setMessage(
            "Recent Pi re-authentication is required before signing out other sessions. Confirm with Pi and try again."
          )
        } else {
          setMessage(data.error || "Could not revoke other sessions")
        }
        return
      }
      setMessage(
        data.revokedCount
          ? `Signed out ${data.revokedCount} other session(s).`
          : "No other active sessions."
      )
      await load()
    } catch {
      setMessage("Network error")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
        <p className="text-[14px] font-bold">Active sessions</p>
      </div>
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        These are GreenHaven server sessions (signed-in devices/browsers). This is separate from
        the local device lock PIN. Revoking a session signs that browser out of GreenHaven.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-[13px] text-amber-600">{error}</p>
      ) : sessions.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No sessions found.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-border bg-background px-3 py-3 space-y-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    {s.deviceLabel}
                    {s.isCurrent ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        <Shield className="h-3 w-3" /> Current
                      </span>
                    ) : null}
                    {!s.active ? (
                      <span className="ml-2 text-[10px] font-bold uppercase text-muted-foreground">
                        Inactive
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Last active {formatWhen(s.lastSeenAt)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Signed in {formatWhen(s.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => void revokeOne(s.id, s.isCurrent)}
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[12px] font-semibold hover:bg-muted/50 disabled:opacity-50"
                >
                  {s.isCurrent ? "Sign out" : "Revoke"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={busyId === "others" || loading}
        onClick={() => void revokeOthers()}
        className="w-full rounded-full border border-border px-4 py-2.5 text-[13px] font-semibold hover:bg-muted/40 disabled:opacity-50"
      >
        Sign out other sessions
      </button>

      {message ? (
        <p className="text-[12px] text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
