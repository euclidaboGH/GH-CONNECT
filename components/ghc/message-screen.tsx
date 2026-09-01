"use client"

/**
 * Messages — inbox + thread UI.
 * Performance: focused context, message window, tab-leave cleanup.
 * UX: All / Unread / Communities filters, clear empty states.
 */
import { useCallback, useEffect, useMemo, useRef, useState, startTransition, memo } from "react"
import { useGHCMessaging } from "@/contexts/ghc-context"
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

const MESSAGE_WINDOW = 50
const WINDOW_STEP = 40

type InboxFilter = "all" | "dms" | "unread" | "communities"

function isCommunityConversation(c: Conversation): boolean {
  return (
    c.conversationType === "group" ||
    Boolean(c.groupName) ||
    String(c.participantName || "").startsWith("Community")
  )
}

export function MessageScreen() {
  const messaging = useGHCMessaging()
  const { conversations: rawConversations, sendMessage, markConversationRead } = messaging
  const ghc = {
    pinConversation: messaging.pinConversation,
    archiveConversation: messaging.archiveConversation,
    muteConversation: messaging.muteConversation,
    matches: [] as unknown[],
    friends: [] as unknown[],
  }

  const conversations = Array.isArray(rawConversations) ? (rawConversations as Conversation[]) : []

  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<InboxFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [windowSize, setWindowSize] = useState(MESSAGE_WINDOW)
  const bottomRef = useRef<HTMLDivElement>(null)
  const markedRef = useRef<string | null>(null)

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
      const id = String((e as CustomEvent).detail?.conversationId || "").trim()
      if (!id) return
      startTransition(() => {
        setSelectedId(id)
        setDraft("")
        setWindowSize(MESSAGE_WINDOW)
        markedRef.current = null
      })
    }
    window.addEventListener("ghc:navigate-tab", onTab as EventListener)
    window.addEventListener("ghc:tab-change", onTab as EventListener)
    window.addEventListener("ghc:open-conversation", onOpenConversation as EventListener)
    return () => {
      window.removeEventListener("ghc:navigate-tab", onTab as EventListener)
      window.removeEventListener("ghc:tab-change", onTab as EventListener)
      window.removeEventListener("ghc:open-conversation", onOpenConversation as EventListener)
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
    const q = query.trim().toLowerCase()
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
  }, [conversations, query, filter])

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
      setWindowSize(MESSAGE_WINDOW)
      markedRef.current = null
    })
  }, [])

  const closeThread = useCallback(() => {
    startTransition(() => {
      setSelectedId(null)
      setDraft("")
      setWindowSize(MESSAGE_WINDOW)
    })
  }, [])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || !selectedId || sending) return
    setSending(true)
    setDraft("")
    try {
      await sendMessage?.(selectedId, text)
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      })
    } catch {
      setDraft(text)
    } finally {
      setSending(false)
    }
  }, [draft, selectedId, sending, sendMessage])

  const goMatches = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "matches" }))
    } catch {
      try {
        window.dispatchEvent(new CustomEvent("ghc:open-matches"))
      } catch {
        /* */
      }
    }
  }, [])

  const goDiscover = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "discover" }))
    } catch {
      /* */
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

        <div
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3"
          style={{ WebkitOverflowScrolling: "touch" }}
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
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <MessageInput
            messageText={draft}
            onMessageChange={setDraft}
            onSendMessage={() => void handleSend()}
            onEmojiClick={() => undefined}
            onAttachmentClick={() => undefined}
            disabled={sending}
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
      <header className="shrink-0 border-b border-border/60 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold tracking-tight">Messages</h1>
            <p className="text-[11px] text-muted-foreground">
              DMs · community chat · board lives under Communities
            </p>
          </div>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
              {unreadCount} new
            </span>
          ) : null}
        </div>
        <div className="mt-2">
          <ConversationSearchBar searchQuery={query} onSearchChange={setQuery} />
        </div>
        <div className="mt-2 flex gap-1 rounded-xl bg-muted/60 p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
                filter === f.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
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
                className="mt-3 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white"
              >
                View all chats
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
                onClick={() => {
                  try {
                    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "communities" }))
                  } catch {
                    /* */
                  }
                }}
                className="mt-3 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white"
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
          <ul>
            {list.map((c) => (
              <li key={c.id}>
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
        )}
      </div>
    </div>
  )
}

export default memo(MessageScreen)
