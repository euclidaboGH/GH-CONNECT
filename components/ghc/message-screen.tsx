"use client"

/**
 * Messages — inbox + thread UI.
 * Performance: focused context, message window, tab-leave cleanup.
 * UX: All / Unread / Communities filters, clear empty states.
 */
import { useCallback, useEffect, useMemo, useRef, useState, startTransition, memo } from "react"
import { useGHCMessaging, useGHC } from "@/contexts/ghc-context"
import { IdentityService } from "@/lib/identity/identity-service"
import {
  ConversationItem,
  ConversationSearchBar,
  MessageBubble,
  MessageInput,
  ChatHeader,
  EmptyMessagesState,
} from "./message-components"
import type { Conversation, Message } from "@/lib/ghc-types"
import { Users, MessageCircle } from "lucide-react"
import { navigateTo } from "@/lib/navigation/navigate"
import { isDurableMessagingEnabled } from "@/lib/messaging/durable-flag"

const MESSAGE_WINDOW = 40
const WINDOW_STEP = 24

type InboxFilter = "all" | "dms" | "unread" | "communities"

function isCommunityConversation(c: Conversation): boolean {
  const any = c as Conversation & {
    kind?: string
    communityId?: string
    isCommunity?: boolean
  }
  if (any.kind === "community" || any.isCommunity === true || Boolean(any.communityId)) return true
  if (c.conversationType === "group" && Boolean(c.groupName)) return true
  if (String(c.participantName || "").startsWith("Community")) return true
  return false
}

export function MessageScreen() {
  const messaging = useGHCMessaging()
  const { conversations: rawConversations, sendMessage, markConversationRead } = messaging
  const { deleteMessage, replyToMessage } = useGHC()
  const ghc = {
    pinConversation: messaging.pinConversation,
    archiveConversation: messaging.archiveConversation,
    muteConversation: messaging.muteConversation,
    matches: [] as string[],
    friends: [] as string[],
  }

  const conversations = useMemo(
    () => (Array.isArray(rawConversations) ? (rawConversations as Conversation[]) : []),
    [rawConversations],
  )

  const [query, setQuery] = useState("")
  /** Debounced query for filtering — keeps typing responsive on long inboxes */
  const [queryDebounced, setQueryDebounced] = useState("")
  const [filter, setFilter] = useState<InboxFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [windowSize, setWindowSize] = useState(MESSAGE_WINDOW)
  const [isOffline, setIsOffline] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyPreview, setReplyPreview] = useState<string | null>(null)
  const durablePreferred = isDurableMessagingEnabled()
  const bottomRef = useRef<HTMLDivElement>(null)
  const markedRef = useRef<string | null>(null)


  useEffect(() => {
    if (typeof window === "undefined") return
    const sync = () => setIsOffline(!navigator.onLine)
    sync()
    const onOnline = () => {
      sync()
      try {
        window.dispatchEvent(new CustomEvent("ghc:messaging-reconcile"))
      } catch {
        /* */
      }
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", sync)
    }
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => setQueryDebounced(query), 180)
    return () => window.clearTimeout(handle)
  }, [query])


  useEffect(() => {
    const onTab = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const tab = typeof detail === "string" ? detail : detail?.tab
      if (typeof tab === "string" && tab !== "messages") {
        setSelectedId(null)
        setDraft("")
        setWindowSize(MESSAGE_WINDOW)
      }
    }
    const onOpenConversation = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      const id = String(detail.conversationId || "").trim()
      if (!id) return
      const kind = String(detail.kind || "").toLowerCase()
      startTransition(() => {
        if (kind === "community" || kind === "group") {
          setFilter("communities")
        }
        setSelectedId(id)
        setDraft("")
        setWindowSize(MESSAGE_WINDOW)
        markedRef.current = null
      })
    }
    const onReconcile = () => {
      // After realtime reconnect / online: drop ephemeral draft UI only (server remains authority)
      setDraft("")
      setWindowSize(MESSAGE_WINDOW)
      markedRef.current = null
    }
    window.addEventListener("ghc:navigate-tab", onTab as EventListener)
    window.addEventListener("ghc:tab-change", onTab as EventListener)
    window.addEventListener("ghc:open-conversation", onOpenConversation as EventListener)
    window.addEventListener("ghc:messaging-reconcile", onReconcile as EventListener)
    return () => {
      window.removeEventListener("ghc:navigate-tab", onTab as EventListener)
      window.removeEventListener("ghc:tab-change", onTab as EventListener)
      window.removeEventListener("ghc:open-conversation", onOpenConversation as EventListener)
      window.removeEventListener("ghc:messaging-reconcile", onReconcile as EventListener)
    }
  }, [])

  const unreadCount = useMemo(
    () =>
      conversations.filter(
        (c) => c && !c.isArchived && (c.unread || (c.unreadCount || 0) > 0),
      ).length,
    [conversations],
  )

  const list = useMemo(() => {
    const q = queryDebounced.trim().toLowerCase()
    let rows = conversations.filter((c) => c && !c.isArchived)
    if (filter === "unread") {
      rows = rows.filter((c) => Boolean(c.unread) || (c.unreadCount || 0) > 0)
    } else if (filter === "communities") {
      rows = rows.filter(isCommunityConversation)
    } else if (filter === "dms") {
      rows = rows.filter((c) => !isCommunityConversation(c))
    }
    if (q) {
      rows = rows.filter((c) => {
        const name = String(c.participantName || c.groupName || "").toLowerCase()
        const last = String(c.lastMessage || "").toLowerCase()
        return name.includes(q) || last.includes(q)
      })
    }
    return rows.slice().sort((a, b) => {
      const pin = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
      if (pin !== 0) return pin
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
    })
  }, [conversations, queryDebounced, filter])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return (
      list.find((c) => c.id === selectedId) ||
      conversations.find((c) => c.id === selectedId) ||
      null
    )
  }, [list, conversations, selectedId])

  const allMessages: Message[] = useMemo(() => {
    const raw = selected?.messages
    return Array.isArray(raw) ? raw : []
  }, [selected])

  const messages: Message[] = useMemo(() => {
    if (allMessages.length <= windowSize) return allMessages
    return allMessages.slice(-windowSize)
  }, [allMessages, windowSize])

  useEffect(() => {
    if (!selectedId || !selected) return
    if (markedRef.current === selectedId) return
    const needsMark = Boolean(selected.unread) || (selected.unreadCount || 0) > 0
    markedRef.current = selectedId
    if (!needsMark) return
    try {
      void markConversationRead?.(selectedId)
    } catch {
      /* */
    }
  }, [selectedId, selected, markConversationRead])

  useEffect(() => {
    if (!selectedId) return
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
    })
    return () => cancelAnimationFrame(id)
  }, [selectedId, messages.length])

  const openThread = useCallback((id: string) => {
    startTransition(() => {
      setSelectedId(id)
      setDraft("")
      setReplyToId(null)
      setReplyPreview(null)
      setWindowSize(MESSAGE_WINDOW)
      markedRef.current = null
    })
  }, [])

  const closeThread = useCallback(() => {
    startTransition(() => {
      setSelectedId(null)
      setDraft("")
      setReplyToId(null)
      setReplyPreview(null)
      setWindowSize(MESSAGE_WINDOW)
    })
  }, [])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || !selectedId || sending) return
    setSending(true)
    setDraft("")
    const replyingTo = replyToId
    setReplyToId(null)
    setReplyPreview(null)
    try {
      if (replyingTo) {
        await replyToMessage(selectedId, replyingTo, text)
      } else {
        await sendMessage?.(selectedId, text)
      }
      setStatusMsg(isOffline ? "Saved locally — will sync when online" : "Message sent")
      window.setTimeout(() => setStatusMsg(null), 2000)
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      })
    } catch {
      // Restore draft so the user can retry; avoid silent failure
      setDraft(text)
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: {
              message: isOffline
                ? "You are offline. Message kept in the composer — send again when online."
                : "Message couldn't be confirmed. Check your connection and try again.",
              type: "error",
            },
          })
        )
      } catch {
        /* */
      }
    } finally {
      setSending(false)
    }
  }, [draft, selectedId, sending, sendMessage, replyToMessage, replyToId, isOffline])

  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closeThread()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId, closeThread])

  const goMatches = useCallback(() => {
    if (!navigateTo("matches")) {
      try {
        window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "matches" }))
      } catch {
        /* */
      }
    }
  }, [])

  const goDiscover = useCallback(() => {
    if (!navigateTo("discover")) {
      try {
        window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "discover" }))
      } catch {
        /* */
      }
    }
  }, [])

  if (selected) {
    const isCommunity = isCommunityConversation(selected)

    return (
      <div className="flex h-full min-h-0 flex-col bg-background text-foreground contain-content">
        <ChatHeader
          participantName={selected.groupName || selected.participantName || "Chat"}
          participantPhoto={selected.groupPhoto || selected.participantPhoto || ""}
          isOnline={Boolean(selected.online)}
          isTyping={Boolean(selected.isTyping)}
          isCommunity={isCommunity}
          onBack={closeThread}
          onOpenProfile={() => {
            if (isCommunity) return
            try {
              window.dispatchEvent(
                new CustomEvent("ghc:open-profile", {
                  detail: { userId: selected.participantId, name: selected.participantName },
                }),
              )
            } catch {
              /* */
            }
          }}
        />

        <div className="sr-only" role="status" aria-live="polite">
          {statusMsg || (sending ? "Sending message" : "")}
        </div>

        {isOffline ? (
          <div
            className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            You are offline. You can still draft a message — send when you reconnect so delivery can be confirmed.
          </div>
        ) : null}

        <div
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 contain-paint"
          role="log"
          aria-label={isCommunity ? "Community chat messages" : "Conversation messages"}
          aria-relevant="additions"
          style={{ WebkitOverflowScrolling: "touch", contentVisibility: "auto" }}
        >
          {allMessages.length > windowSize && (
            <button
              type="button"
              onClick={() => setWindowSize((w) => Math.min(allMessages.length, w + WINDOW_STEP))}
              className="mx-auto mb-2 block rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
            >
              Load earlier ({allMessages.length - windowSize} more)
            </button>
          )}
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                <MessageCircle size={28} className="text-emerald-600" />
              </div>
              <p className="text-[14px] font-bold text-foreground">No messages yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {isCommunity
                  ? "Be the first to say hello in this community chat."
                  : `Say hello to ${selected.participantName || "them"}.`}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isSentByCurrentUser={
                  msg.senderId === IdentityService.getCurrentUserId() || msg.senderId === "current-user" || Boolean((msg as { isOwn?: boolean }).isOwn)
                }
                onReply={(id) => {
                  setReplyToId(id)
                  setReplyPreview((msg.text || "").slice(0, 80))
                }}
                onCopy={(text) => {
                  try {
                    void navigator.clipboard?.writeText(text)
                    setStatusMsg("Copied")
                    window.setTimeout(() => setStatusMsg(null), 1500)
                  } catch {
                    /* */
                  }
                }}
                onDelete={(id, forEveryone) => {
                  void deleteMessage(selectedId!, id, Boolean(forEveryone))
                }}
                onRetry={
                  msg.status === "failed"
                    ? () => {
                        if (msg.text) {
                          setDraft(msg.text)
                          setStatusMsg("Edit and send again")
                          window.setTimeout(() => setStatusMsg(null), 2000)
                        }
                      }
                    : undefined
                }
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {replyToId ? (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Replying</p>
                <p className="truncate text-[12px] text-foreground">{replyPreview || "Message"}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setReplyToId(null)
                  setReplyPreview(null)
                }}
                aria-label="Cancel reply"
              >
                Cancel
              </button>
            </div>
          ) : null}
          {selected.isMuted ? (
            <p className="mb-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
              This conversation is muted — you still receive messages here; notifications stay quiet.
            </p>
          ) : null}
          <MessageInput
            messageText={draft}
            onMessageChange={setDraft}
            onSendMessage={() => void handleSend()}
            onEmojiClick={() => {
              /* MessageInput owns the emoji sheet */
            }}
            onAttachmentClick={() => {
              try {
                window.dispatchEvent(
                  new CustomEvent("ghc:toast", {
                    detail: {
                      message: "Attachments are not enabled in this build (media storage gated).",
                      type: "info",
                    },
                  })
                )
              } catch { /* */ }
            }}
            disabled={sending || isOffline}
          />
        </div>
      </div>
    )
  }

  const filters: { id: InboxFilter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "dms", label: "DMs" },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "communities", label: "Communities" },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground contain-content">
      <div className="px-3 pt-2" role="status">
        {isOffline ? (
          <p className="rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Offline — messages queue on this device and sync when you reconnect.
          </p>
        ) : durablePreferred ? (
          <p className="rounded-[1.25rem] border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-2 text-[11px] leading-snug text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            Durable messaging enabled — server confirms delivery when online.
          </p>
        ) : (
          <p className="rounded-[1.25rem] border border-border/50 bg-muted/40 px-3.5 py-2 text-[11px] leading-snug text-muted-foreground">
            Hybrid messaging — server write attempted online; local copy kept if the network fails.
          </p>
        )}
      </div>
      <header className="shrink-0 border-b border-border/50 bg-card/95 px-3 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-foreground">Messages</h1>
            <p className="text-[11px] text-muted-foreground">
              DMs · community chat · board lives under Communities
            </p>
          </div>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-[var(--gh-green)] px-2.5 py-0.5 text-[11px] font-bold text-white tabular-nums shadow-sm">
              {unreadCount} new
            </span>
          ) : null}
        </div>
        <div className="mt-2.5">
          <ConversationSearchBar searchQuery={query} onSearchChange={setQuery} />
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Private messages stay separate from community boards.
        </p>
        <div
          className="mt-2 flex gap-1 rounded-2xl border border-border/50 bg-muted/50 p-1"
          role="tablist"
          aria-label="Inbox filters"
          onKeyDown={(e) => {
            const order: InboxFilter[] = ["all", "dms", "unread", "communities"]
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return
            e.preventDefault()
            const idx = order.indexOf(filter)
            if (idx < 0) return
            let next = idx
            if (e.key === "ArrowRight") next = (idx + 1) % order.length
            if (e.key === "ArrowLeft") next = (idx - 1 + order.length) % order.length
            if (e.key === "Home") next = 0
            if (e.key === "End") next = order.length - 1
            setFilter(order[next])
          }}
        >
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-bold transition ${
                filter === f.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.id === "communities" ? <Users size={12} aria-hidden /> : null}
              {f.label}
              {typeof f.count === "number" && f.count > 0 ? (
                <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                  {f.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {list.length === 0 ? (
          filter === "unread" ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-[14px] font-bold">All caught up</p>
              <p className="mt-1 text-[12px] text-muted-foreground">No unread conversations.</p>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-3 rounded-full bg-[var(--gh-green)] px-4 py-2 text-[12px] font-bold text-white shadow-sm"
              >
                View all chats
              </button>
            </div>
          ) : filter === "dms" ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-[14px] font-bold">No direct messages yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Find people on Discover or Matches, then start a chat.
              </p>
              <button
                type="button"
                onClick={() => navigateTo("discover")}
                className="mt-3 rounded-full bg-[var(--gh-green)] px-4 py-2 text-[12px] font-bold text-white shadow-sm"
              >
                Discover people
              </button>
            </div>
          ) : filter === "communities" ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-[14px] font-bold">No community chats yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Join a community, then open Chat from the community hub.
              </p>
              <button
                type="button"
                onClick={() => navigateTo("communities")}
                className="mt-3 rounded-full bg-[var(--gh-green)] px-4 py-2 text-[12px] font-bold text-white shadow-sm"
              >
                Browse communities
              </button>
            </div>
          ) : (
            <EmptyMessagesState
              onNavigateToMatches={goMatches}
              onNavigateToFind={goDiscover}
              hasMatches={Array.isArray(ghc.matches) && ghc.matches.length > 0}
              hasConnections={Array.isArray(ghc.friends) && ghc.friends.length > 0}
            />
          )
        ) : (
          <>
          <p className="px-3 pb-1 text-[11px] font-medium text-muted-foreground" aria-live="polite">
            {list.length} conversation{list.length === 1 ? "" : "s"}
            {queryDebounced.trim() ? " matching search" : ""}
          </p>
          <ul className="contain-content" role="list" aria-label="Conversations">
            {list.map((c) => (
              <li key={c.id} className="content-visibility-auto" style={{ contentVisibility: "auto", containIntrinsicSize: "72px" }}>
                <ConversationItem
                  conversation={c}
                  isSelected={false}
                  onClick={() => openThread(c.id)}
                  onPin={ghc.pinConversation}
                  onArchive={ghc.archiveConversation}
                  onMute={ghc.muteConversation}
                  onOpenProfile={() => {
                    if (isCommunityConversation(c)) return
                    try {
                      window.dispatchEvent(
                        new CustomEvent("ghc:open-profile", {
                          detail: { userId: c.participantId, name: c.participantName },
                        }),
                      )
                    } catch {
                      /* */
                    }
                  }}
                />
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
    </div>
  )
}

export default memo(MessageScreen)
