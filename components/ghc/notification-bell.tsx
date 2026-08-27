"use client"

/**
 * NotificationBell — header icon + panel (not a bottom-nav tab).
 * Reads from notificationSystem (local) with mark-read + deep-link hooks.
 */

import { useCallback, useEffect, useState } from "react"
import { onCloseTransientUI, dispatchCloseTransientUI } from "@/lib/transient-ui"
import { Bell, X, Heart, MessageCircle, UserPlus, Users, Info } from "lucide-react"
import {
  notificationSystem,
  type Notification,
  type NotificationType,
} from "@/lib/notifications"

const ICON: Partial<Record<NotificationType, React.ReactNode>> = {
  like: <Heart size={14} className="text-rose-500" />,
  comment: <MessageCircle size={14} className="text-blue-500" />,
  message: <MessageCircle size={14} className="text-purple-600" />,
  match: <Heart size={14} className="text-pink-500" />,
  friend_request: <UserPlus size={14} className="text-emerald-600" />,
  follow: <Users size={14} className="text-indigo-600" />,
  system: <Info size={14} className="text-gray-500" />,
  story_reply: <MessageCircle size={14} className="text-fuchsia-600" />,
  share: <Users size={14} className="text-violet-600" />,
  group: <Users size={14} className="text-indigo-500" />,
}

function timeLabel(ts: number) {
  const d = Date.now() - ts
  if (d < 60_000) return "now"
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`
  return `${Math.floor(d / 86_400_000)}d`
}

export function NotificationBell({
  onOpenTarget,
}: {
  /** Optional: navigate when user taps a notification */
  onOpenTarget?: (n: Notification) => void
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [filterCat, setFilterCat] = useState<"all" | "wallet" | "requests" | NotificationType | "mentions">("all")

  const refresh = useCallback(() => {
    try {
      const visible =
        typeof notificationSystem.getVisibleNotifications === "function"
          ? notificationSystem.getVisibleNotifications()
          : notificationSystem.getNotifications()
      const all = visible.slice().reverse()
      // Dedupe by id
      const seen = new Set<string>()
      const unique = all.filter((n) => {
        if (!n.id || seen.has(n.id)) return false
        seen.add(n.id)
        return true
      })
      setItems(unique.slice(0, 60))
      setUnread(unique.filter((n) => !n.read).length)
    } catch {
      setItems([])
      setUnread(0)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    if (!open) return
    return onCloseTransientUI(() => setOpen(false))
  }, [open])

  const filtered = items.filter((n) => {
    if (filterCat === "all") return true
    if (filterCat === "wallet") {
      const cat = (n.data as any)?.category
      const ghc = (n.data as any)?.ghcEvent
      return cat === "wallet" || !!ghc || /GHC|Wallet/i.test(n.title || "")
    }
    if (filterCat === "requests") {
      return (n.data as any)?.open === "requests" || /request/i.test(n.title || "")
    }
    if (filterCat === "mentions") return n.type === "comment" || /mention/i.test(n.title || "")
    return n.type === filterCat
  })

  const markAll = () => {
    try {
      notificationSystem.markAllAsRead()
    } catch {
      try {
        items.filter((n) => !n.read).forEach((n) => notificationSystem.markAsRead(n.id))
      } catch {
        /* */
      }
    }
    refresh()
  }

  const onTap = (n: Notification) => {
    try {
      notificationSystem.markAsRead(n.id)
    } catch {
      /* */
    }
    refresh()
    setOpen(false)
    dispatchCloseTransientUI({ reason: "navigate" })

    const data = (n.data || {}) as Record<string, unknown>
    const openTarget = data.open as string | undefined
    const type = n.type

    // Deep-link to the right primary section
    let tab: string | null = null
    if (type === "message" || openTarget === "messages") tab = "messages"
    else if (type === "match" || openTarget === "matches") tab = "matches"
    else if (type === "follow" || type === "friend_request" || openTarget === "find") tab = "discover"
    else if (type === "group" || openTarget === "communities") tab = "communities"
    else if (type === "comment" || type === "like" || openTarget === "feed") tab = "home"
    else if (openTarget === "wallet" || openTarget === "transaction" || data.ghcEvent) tab = "profile"
    else if (openTarget === "requests") tab = "messages"

    if (tab) {
      try {
        window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
      } catch {
        /* */
      }
    }
    onOpenTarget?.(n)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          refresh()
        }}
        className="relative rounded-full p-2 hover:bg-gray-100 active:scale-95"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell size={18} className="text-gray-700" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-card">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" aria-label="Close" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-1.5rem,20rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
              <p className="text-sm font-bold text-gray-900">Notifications</p>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button type="button" onClick={markAll} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-gray-50 px-2 py-1.5 scrollbar-hide" role="tablist">
              {(["all", "wallet", "requests", "like", "comment", "follow", "message", "match"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={filterCat === cat}
                  onClick={() => setFilterCat(cat as typeof filterCat)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize transition ${
                    filterCat === cat ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-emerald-50"
                  }`}
                >
                  {cat === "all" ? "All" : cat === "wallet" ? "GHC" : cat === "requests" ? "Requests" : cat}
                </button>
              ))}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-gray-800">You&apos;re all caught up</p>
                  <p className="mt-1 text-xs text-gray-500">Likes, comments, follows, messages and GHC activity will show up here.</p>
                </div>
              ) : (
                <ul>
                  {filtered.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onTap(n)}
                        className={`flex w-full gap-2.5 px-3 py-2.5 text-left transition hover:bg-gray-50 ${
                          !n.read ? "bg-emerald-50/60" : ""
                        }`}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                          {ICON[n.type] || <Bell size={14} className="text-gray-500" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-gray-900">{n.title}</span>
                          <span className="mt-0.5 block line-clamp-2 text-[11px] text-gray-600">{n.message}</span>
                          <span className="mt-0.5 block text-[10px] text-gray-400">{timeLabel(n.timestamp)}</span>
                        </span>
                        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
