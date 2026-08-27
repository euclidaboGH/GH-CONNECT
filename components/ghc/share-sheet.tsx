"use client"

/**
 * ShareSheet V1.1 — tighter layout, recent chats, empty-state CTAs.
 * Still reference-only: never duplicates the original post.
 */

import { useEffect, useMemo, useState } from "react"
import { onCloseTransientUI } from "@/lib/transient-ui"
import {
  X,
  Newspaper,
  Circle,
  MessageCircle,
  Users,
  Link2,
  Check,
  Search,
  UserPlus,
  Compass,
} from "lucide-react"
import type { Post, Conversation } from "@/lib/ghc-types"
import type { ShareVisibility } from "@/lib/share-types"
import {
  ShareService,
  type ShareContext,
  type ShareResult,
} from "@/lib/share-service"

type DestTab = "timeline" | "story" | "private" | "group" | "link"

export function ShareSheet({
  post,
  open,
  onClose,
  shareContext,
  onComplete,
  onFindPeople,
  onDiscoverCommunities,
}: {
  post: Post
  open: boolean
  onClose: () => void
  shareContext: ShareContext
  onComplete: (result: ShareResult) => void
  /** Navigate to Find People when Chat is empty */
  onFindPeople?: () => void
  /** Navigate to Communities when Group is empty */
  onDiscoverCommunities?: () => void
}) {
  const [tab, setTab] = useState<DestTab>("timeline")
  const [caption, setCaption] = useState("")
  const [visibility, setVisibility] = useState<ShareVisibility>("public")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const privateChats = useMemo(
    () =>
      shareContext.conversations
        .filter((c) => c.conversationType === "private" && !c.isArchived)
        .slice()
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)),
    [shareContext.conversations]
  )
  const groups = useMemo(
    () => shareContext.conversations.filter((c) => c.conversationType === "group"),
    [shareContext.conversations]
  )
  const recent = useMemo(() => privateChats.slice(0, 8), [privateChats])

  const filteredPrivate = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return privateChats
    return privateChats.filter((c) => (c.participantName || "").toLowerCase().includes(q))
  }, [privateChats, query])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((c) =>
      (c.participantName || (c as any).groupName || "").toLowerCase().includes(q)
    )
  }, [groups, query])

  useEffect(() => {
    if (!open) return
    return onCloseTransientUI(() => onClose())
  }, [open, onClose])

  if (!open) return null

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      let result
      if (tab === "timeline") {
        result = ShareService.shareToTimeline(shareContext, post.id, caption, visibility)
      } else if (tab === "story") {
        result = ShareService.shareToStory(shareContext, post.id, caption)
      } else if (tab === "private") {
        result = ShareService.shareToPrivateChats(shareContext, post.id, selectedIds, caption)
      } else if (tab === "group") {
        result = ShareService.shareToGroupChats(shareContext, post.id, selectedIds, caption)
      } else {
        result = ShareService.copyPostLink(shareContext, post.id)
        if (result.ok && result.link && typeof navigator !== "undefined") {
          try {
            if (navigator.share) {
              await navigator.share({ title: "GH Connect", text: "Check this post", url: result.link })
            } else if (navigator.clipboard) {
              await navigator.clipboard.writeText(result.link)
            }
          } catch {
            try {
              if (navigator.clipboard) await navigator.clipboard.writeText(result.link)
            } catch { /* ignore */ }
          }
        }
      }
      if (!result.ok) {
        setError(result.error)
        return
      }
      onComplete(result)
      onClose()
      setCaption("")
      setSelectedIds([])
      setQuery("")
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: DestTab; label: string; icon: React.ReactNode }[] = [
    { id: "timeline", label: "Timeline", icon: <Newspaper size={14} /> },
    { id: "story", label: "Story", icon: <Circle size={14} /> },
    { id: "private", label: "Chat", icon: <MessageCircle size={14} /> },
    { id: "group", label: "Group", icon: <Users size={14} /> },
    { id: "link", label: "Link", icon: <Link2 size={14} /> },
  ]

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end bg-black/45 sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Share post"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(92vh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <h2 className="text-base font-bold text-gray-900">Share</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Original post preview */}
        <div className="shrink-0 border-b border-gray-50 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Sharing original post</p>
          <div className="mt-1.5 flex gap-2.5 rounded-xl border border-gray-100 bg-gray-50 p-2">
            {post.images?.[0] ? (
              <img src={post.images[0]} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[10px] font-bold text-emerald-700">
                Post
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-gray-900">{post.authorName}</p>
              <p className="line-clamp-2 text-[11px] leading-4 text-gray-600">{post.content || "Shared media"}</p>
            </div>
          </div>
        </div>

        {/* Recent people — always visible for speed */}
        {recent.length > 0 && (
          <div className="shrink-0 border-b border-gray-50 px-4 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recent</p>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {recent.map((c) => {
                const selected = selectedIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setTab("private")
                      toggleId(c.id)
                    }}
                    className={`flex w-14 shrink-0 flex-col items-center gap-1 ${selected ? "opacity-100" : "opacity-90"}`}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold ${
                        selected ? "ring-2 ring-emerald-600 ring-offset-1 bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {(c.participantName || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="w-full truncate text-center text-[10px] font-medium text-gray-700">
                      {(c.participantName || "Chat").split(" ")[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Destination tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                setError(null)
                if (t.id !== "private" && t.id !== "group") setSelectedIds([])
              }}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${
                tab === t.id ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2.5">
          {tab !== "link" && (
            <label className="mb-2.5 block">
              <span className="text-[11px] font-semibold text-gray-500">
                {tab === "timeline" ? "Add your thoughts (optional)" : "Message (optional)"}
              </span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                rows={2}
                placeholder={
                  tab === "timeline"
                    ? "Why are you sharing this?"
                    : tab === "story"
                      ? "Add text to your story…"
                      : "Message to send with the post…"
                }
                className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          )}

          {tab === "timeline" && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500">Visibility</p>
              {(
                [
                  ["public", "Everyone"],
                  ["followers", "Followers"],
                  ["friends", "Friends"],
                  ["only_me", "Only me"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVisibility(value)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium ${
                    visibility === value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {label}
                  {visibility === value && <Check size={16} className="text-emerald-600" />}
                </button>
              ))}
              <p className="pt-1 text-[11px] text-gray-400">
                Share keeps a reference to the original — likes and comments stay on the source post.
              </p>
            </div>
          )}

          {tab === "story" && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
              Adds a 24h story that links to the original post. Nothing is duplicated.
            </p>
          )}

          {(tab === "private" || tab === "group") && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tab === "private" ? "Search chats…" : "Search communities…"}
                  className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>
              {(tab === "private" ? filteredPrivate : filteredGroups).length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-5 text-center">
                  <p className="text-xs text-gray-600">
                    {tab === "private"
                      ? "No private conversations yet."
                      : "You're not in any groups yet."}
                  </p>
                  {tab === "private" && onFindPeople && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onFindPeople()
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <UserPlus size={14} /> Find people
                    </button>
                  )}
                  {tab === "group" && onDiscoverCommunities && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onDiscoverCommunities()
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <Compass size={14} /> Discover communities
                    </button>
                  )}
                </div>
              ) : (
                <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                  {(tab === "private" ? filteredPrivate : filteredGroups).map((c) => {
                    const name = c.participantName || (c as any).groupName || "Conversation"
                    const selected = selectedIds.includes(c.id)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggleId(c.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                            selected ? "bg-emerald-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border text-[10px] ${
                              selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300"
                            }`}
                          >
                            {selected ? "✓" : ""}
                          </span>
                          <span className="truncate text-sm font-medium text-gray-900">{name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === "link" && (
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600">
              <p className="font-semibold text-gray-800">Copy post link</p>
              <p className="mt-1 break-all font-mono text-[11px] text-emerald-700">ghconnect://post/{post.id}</p>
            </div>
          )}

          {error && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 p-3">
          <button
            type="button"
            disabled={busy || ((tab === "private" || tab === "group") && selectedIds.length === 0 && recent.every((r) => !selectedIds.includes(r.id)))}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy
              ? "Sharing…"
              : tab === "link"
                ? "Copy link"
                : tab === "timeline"
                  ? "Share to timeline"
                  : tab === "story"
                    ? "Add to story"
                    : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}
