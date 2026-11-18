"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Users, X } from "lucide-react"

type Invite = { id: string; conversationId: string; title: string; invitedBy: string; createdAt: number }

export function GroupInvitesPanel() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/messaging/group-invites", { credentials: "include", cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok || !Array.isArray(payload.invites)) throw new Error("INVITES_UNAVAILABLE")
      setInvites(payload.invites.filter((row: unknown): row is Invite => Boolean(row && typeof row === "object" && typeof (row as Invite).id === "string" && typeof (row as Invite).conversationId === "string")))
      setUnavailable(false)
    } catch {
      setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onRefresh = () => void refresh()
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh() }
    window.addEventListener("ghc:group-invites-refresh", onRefresh)
    window.addEventListener("ghc:messages-refresh", onRefresh)
    window.addEventListener("focus", onRefresh)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("ghc:group-invites-refresh", onRefresh)
      window.removeEventListener("ghc:messages-refresh", onRefresh)
      window.removeEventListener("focus", onRefresh)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [refresh])

  const respond = async (invite: Invite, accept: boolean) => {
    if (busyId) return
    setBusyId(invite.id)
    try {
      const response = await fetch(`/api/messaging/group-invites/${encodeURIComponent(invite.id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }), cache: "no-store",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "INVITE_RESPONSE_FAILED")
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: accept ? "Group invitation accepted" : "Group invitation declined", type: "success" } }))
      if (accept) window.dispatchEvent(new CustomEvent("ghc:messages-refresh", { detail: { reason: "group-invite-accepted", conversationId: invite.conversationId } }))
    } catch (error) {
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: error instanceof Error ? error.message : "Could not update invitation", type: "error" } }))
    } finally {
      setBusyId(null)
    }
  }

  if (!invites.length && !unavailable) return null
  return (
    <section className="mx-3 mt-2 rounded-2xl border border-border/70 bg-card p-3" aria-label="Group invitations">
      <div className="mb-2 flex items-center gap-2">
        <Users size={15} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
        <h2 className="text-xs font-bold text-foreground">Group invitations</h2>
        {invites.length > 0 ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums">{invites.length}</span> : null}
      </div>
      {unavailable ? <p className="text-[11px] text-muted-foreground" role="status">Invitations are temporarily unavailable. They have not been assumed accepted.</p> : null}
      {loading && !invites.length ? <p className="text-[11px] text-muted-foreground">Checking invitations…</p> : null}
      <div className="space-y-2">
        {invites.map((invite) => (
          <div key={invite.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/45 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{invite.title || "Group invitation"}</p>
              <p className="text-[10px] text-muted-foreground">Invited by a GreenHaven member</p>
            </div>
            <button type="button" disabled={busyId === invite.id} onClick={() => void respond(invite, true)} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[var(--gh-green)] px-3 text-[10px] font-bold text-white disabled:opacity-50"><Check size={12} /> Accept</button>
            <button type="button" disabled={busyId === invite.id} onClick={() => void respond(invite, false)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-background px-3 text-[10px] font-semibold text-muted-foreground disabled:opacity-50"><X size={12} /> Decline</button>
          </div>
        ))}
      </div>
    </section>
  )
}
