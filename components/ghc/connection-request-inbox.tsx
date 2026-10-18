"use client"

/**
 * Connection Request Inbox — Incoming / Outgoing.
 * Uses unified adapter; session graph until durable migration applied.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, X, User, ArrowLeft, Inbox } from "lucide-react"
import { IdentityService } from "@/lib/identity/identity-service"
import { useGHC } from "@/contexts/ghc-context"
import {
  buildConnectionRequestInbox,
  type ConnectionRequestInboxItem,
} from "@/lib/domains/adapters/connection-request-inbox"
import {
  acceptUnifiedConnectionRequest,
  declineUnifiedConnectionRequest,
} from "@/lib/domains/adapters/unified-connection-request"
import { timeAgo } from "@/lib/ghc-data"

type Props = {
  onClose?: () => void
  initialTab?: "incoming" | "outgoing"
}

function RequestCard({
  item,
  direction,
  displayName,
  avatarUrl,
  busy,
  onAccept,
  onDecline,
  onProfile,
}: {
  item: ConnectionRequestInboxItem
  direction: "incoming" | "outgoing"
  displayName: string
  avatarUrl?: string
  busy: boolean
  onAccept?: () => void
  onDecline?: () => void
  onProfile: () => void
}) {
  const when = item.createdAt ? timeAgo(item.createdAt) : "Recently"
  const intentText =
    item.intentLabels.length > 0
      ? item.intentLabels.slice(0, 3).join(" · ")
      : "Connection request"

  return (
    <article
      className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm"
      data-request-state={item.state}
      data-source={item.dataSource}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onProfile}
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-muted ring-1 ring-border"
          aria-label={`View ${displayName}`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <User size={18} className="text-muted-foreground" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onProfile}
              className="truncate text-left text-sm font-semibold text-foreground hover:text-emerald-700"
            >
              {displayName}
            </button>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {direction === "incoming" ? "Incoming" : "Outgoing"}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-foreground/85">
            <span className="font-medium text-teal-700 dark:text-teal-400">Intent: </span>
            {intentText}
          </p>
          {item.note ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.note}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-muted-foreground">
            {when}
            {item.dataSource === "session_graph" ? " · Session graph" : " · Synced"}
          </p>
        </div>
      </div>

      {direction === "incoming" ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            <Check size={16} /> Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <X size={16} /> Decline
          </button>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
          Waiting for them to accept. You can view their profile anytime.
        </p>
      )}
    </article>
  )
}

export function ConnectionRequestInbox({ onClose, initialTab = "incoming" }: Props) {
  const meId = IdentityService.getCurrentUserId()
  const ghc = useGHC() as {
    candidates?: Array<{ id: string; name?: string; photo?: string }>
    addToast?: (m: string, t?: string) => void
    blockedUsers?: string[]
  }
  const [tab, setTab] = useState<"incoming" | "outgoing">(initialTab)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tick, setTick] = useState<number>(0)
  const [durableAvailable, setDurableAvailable] = useState(false)
  const [serverIncoming, setServerIncoming] = useState<ConnectionRequestInboxItem[]>([])
  const [serverOutgoing, setServerOutgoing] = useState<ConnectionRequestInboxItem[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { socialFetchConnectionInbox } = await import("@/lib/social/client")
        const remote = await socialFetchConnectionInbox()
        if (cancelled || !remote.ok) return
        if (remote.durable) setDurableAvailable(true)
        const toItem = (
          row: { fromUserId: string; toUserId: string; intents?: string[]; note?: string; source?: string; createdAt?: number },
          direction: "incoming" | "outgoing"
        ): ConnectionRequestInboxItem => ({
          fromUserId: row.fromUserId,
          toUserId: row.toUserId,
          direction,
          intents: (row.intents || []) as ConnectionRequestInboxItem["intents"],
          intentLabels: [],
          note: row.note,
          source: row.source,
          createdAt: row.createdAt,
          state: direction === "incoming" ? "incoming_pending" : "outgoing_pending",
          dataSource: remote.durable ? "server_durable" : "session_graph",
        })
        setServerIncoming((remote.incoming || []).map((r) => toItem(r, "incoming")))
        setServerOutgoing((remote.outgoing || []).map((r) => toItem(r, "outgoing")))
      } catch {
        /* */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tick, meId])

  // Re-fetch when app focuses or another surface reports a social mutation
  useEffect(() => {
    if (typeof window === "undefined") return
    const bump = () => setTick((n) => n + 1)
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") bump()
    }
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("focus", bump)
    window.addEventListener("ghc:connection-inbox-updated", bump)
    window.addEventListener("ghc:social-mutation", bump)
    window.addEventListener("ghc:connection-updated", bump)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("focus", bump)
      window.removeEventListener("ghc:connection-inbox-updated", bump)
      window.removeEventListener("ghc:social-mutation", bump)
      window.removeEventListener("ghc:connection-updated", bump)
    }
  }, [])

  const inbox = useMemo(() => {
    void tick
    const session = buildConnectionRequestInbox(meId, { durableAvailable })
    // Prefer server rows when present; merge session-only pairs
    const key = (i: ConnectionRequestInboxItem) => `${i.fromUserId}→${i.toUserId}`
    const inMap = new Map<string, ConnectionRequestInboxItem>()
    for (const i of session.incoming) inMap.set(key(i), i)
    for (const i of serverIncoming) inMap.set(key(i), { ...i, dataSource: durableAvailable ? "server_durable" : i.dataSource })
    const outMap = new Map<string, ConnectionRequestInboxItem>()
    for (const i of session.outgoing) outMap.set(key(i), i)
    for (const i of serverOutgoing) outMap.set(key(i), { ...i, dataSource: durableAvailable ? "server_durable" : i.dataSource })
    return {
      incoming: Array.from(inMap.values()),
      outgoing: Array.from(outMap.values()),
      dataSource: durableAvailable ? ("server_durable" as const) : session.dataSource,
    }
  }, [meId, tick, durableAvailable, serverIncoming, serverOutgoing])

  const blocked = new Set(ghc.blockedUsers || [])
  const candMap = useMemo(() => {
    const m = new Map<string, { name: string; photo?: string }>()
    for (const c of ghc.candidates || []) {
      m.set(c.id, { name: c.name || "Member", photo: c.photo })
    }
    return m
  }, [ghc.candidates])

  const resolvePerson = useCallback(
    (userId: string) => {
      const c = candMap.get(userId)
      return {
        displayName: c?.name || `Member`,
        avatarUrl: c?.photo,
      }
    },
    [candMap]
  )

  const filteredIncoming = inbox.incoming.filter(
    (i) => !blocked.has(i.fromUserId)
  )
  const filteredOutgoing = inbox.outgoing.filter(
    (i) => !blocked.has(i.toUserId)
  )

  const onAccept = async (fromUserId: string) => {
    setBusyId(fromUserId)
    try {
      const r = await acceptUnifiedConnectionRequest(meId, fromUserId)
      if (!r.ok) ghc.addToast?.(r.error || "Could not accept", "error")
      else {
        ghc.addToast?.("Connected", "success")
        setTick((n) => n + 1)
      }
    } finally {
      setBusyId(null)
    }
  }

  const onDecline = async (fromUserId: string) => {
    setBusyId(fromUserId)
    try {
      const r = await declineUnifiedConnectionRequest(meId, fromUserId)
      if (!r.ok) ghc.addToast?.(r.error || "Could not decline", "error")
      else {
        ghc.addToast?.("Request declined", "info")
        setTick((n) => n + 1)
      }
    } finally {
      setBusyId(null)
    }
  }

  const openProfile = (userId: string, name: string) => {
    try {
      window.dispatchEvent(
        new CustomEvent("ghc:open-profile", { detail: { userId, name } })
      )
    } catch {
      /* */
    }
  }

  const list = tab === "incoming" ? filteredIncoming : filteredOutgoing

  return (
    <div className="flex h-full flex-col bg-background" role="dialog" aria-label="Connection requests">
      <header className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-foreground">Connection requests</h2>
          <p className="text-[11px] text-muted-foreground">
            Explicit requests only — matches are not connections
          </p>
        </div>
        <Inbox size={18} className="text-teal-600" aria-hidden />
      </header>

      <div className="flex gap-1 border-b border-border/50 px-3 py-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "incoming"}
          onClick={() => setTab("incoming")}
          className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition ${
            tab === "incoming"
              ? "bg-teal-600 text-white"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Incoming ({filteredIncoming.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition ${
            tab === "outgoing"
              ? "bg-teal-600 text-white"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Outgoing ({filteredOutgoing.length})
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 pb-24">
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">
              {tab === "incoming" ? "No incoming requests" : "No outgoing requests"}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {tab === "incoming"
                ? "When someone sends a connection request, it appears here."
                : "Requests you send will show here until they respond."}
            </p>
          </div>
        ) : (
          list.map((item) => {
            const peerId = tab === "incoming" ? item.fromUserId : item.toUserId
            const person = resolvePerson(peerId)
            return (
              <RequestCard
                key={`${item.fromUserId}-${item.toUserId}-${item.state}`}
                item={item}
                direction={tab}
                displayName={person.displayName}
                avatarUrl={person.avatarUrl}
                busy={busyId === item.fromUserId || busyId === item.toUserId}
                onAccept={
                  tab === "incoming" ? () => void onAccept(item.fromUserId) : undefined
                }
                onDecline={
                  tab === "incoming" ? () => void onDecline(item.fromUserId) : undefined
                }
                onProfile={() => openProfile(peerId, person.displayName)}
              />
            )
          })
        )}

        {inbox.dataSource === "session_graph" ? (
          <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
            Some connection requests are available only on this device right now.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default ConnectionRequestInbox
