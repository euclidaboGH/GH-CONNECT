"use client"

/**
 * Messages — inbox + thread UI.
 * Performance: focused context, message window, tab-leave cleanup.
 * UX: All / Unread / Communities filters, clear empty states.
 */
import { useCallback, useEffect, useMemo, useRef, useState, startTransition, memo } from "react"
import { useGHCMessaging, useGHC } from "@/contexts/ghc-context"
import { useDomainEvents } from "@/lib/realtime/use-domain-events"
import { useSectionRefresh } from "@/hooks/use-section-refresh"
import { IdentityService } from "@/lib/identity/identity-service"
import { userFacingError, toastError } from "@/lib/ux/user-facing-errors"
import {
  ConversationItem,
  ConversationSearchBar,
  MessageBubble,
  MessageInput,
  ChatHeader,
  EmptyMessagesState,
} from "./message-components"
import type { Conversation, Message } from "@/lib/ghc-types"
import { Users, MessageCircle, ArrowRight, ShieldCheck, Sparkles } from "lucide-react"
import { navigateTo } from "@/lib/navigation/navigate"
import { isDurableMessagingEnabled } from "@/lib/messaging/durable-flag"
import { apiTouchConversationPresence, apiEnsureConversationMember } from "@/lib/messaging/server-messaging-sync"
import { buildRelationshipOutcome } from "@/lib/relationship-outcomes"

const MESSAGE_WINDOW = 40
const WINDOW_STEP = 24

type InboxFilter = "all" | "dms" | "unread" | "requests" | "communities"
type PeerPresence = { userId: string; online: boolean; lastSeenAt: number | null; isTyping: boolean }

function formatLastSeen(lastSeenAt: number | null | undefined): string {
  if (!lastSeenAt || !Number.isFinite(lastSeenAt)) return "Last seen unavailable"
  const elapsed = Math.max(0, Date.now() - lastSeenAt)
  if (elapsed < 60_000) return "Last seen just now"
  if (elapsed < 60 * 60_000) return `Last seen ${Math.floor(elapsed / 60_000)} min ago`
  if (elapsed < 24 * 60 * 60_000) return `Last seen ${Math.floor(elapsed / (60 * 60_000))} hr ago`
  if (elapsed < 7 * 24 * 60 * 60_000) return `Last seen ${Math.floor(elapsed / (24 * 60 * 60_000))} d ago`
  return `Last seen ${new Date(lastSeenAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
}

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
  const { conversations: rawConversations, sendMessage, sendMediaMessage,
    loadConversationMessages, markConversationRead } = messaging
  const { deleteMessage, replyToMessage, matches, friends, candidates } = useGHC() as {
    deleteMessage?: (id: string) => void
    replyToMessage?: (...args: unknown[]) => void
    matches?: unknown[]
    friends?: unknown[]
    candidates?: unknown[]
  }
  const ghc = {
    pinConversation: messaging.pinConversation,
    archiveConversation: messaging.archiveConversation,
    muteConversation: messaging.muteConversation,
    matches: Array.isArray(matches) ? matches : [],
    friends: Array.isArray(friends) ? friends : [],
    candidates: Array.isArray(candidates) ? candidates : [],
    refreshConversations: (messaging as { refreshConversations?: () => Promise<unknown> }).refreshConversations,
    loadConversations: (messaging as { loadConversations?: () => Promise<unknown> }).loadConversations,
  }

  const conversations = useMemo(
    () => (Array.isArray(rawConversations) ? (rawConversations as Conversation[]) : []),
    [rawConversations],
  )

  const [query, setQuery] = useState("")
  /** Debounced query for filtering — keeps typing responsive on long inboxes */
  const [queryDebounced, setQueryDebounced] = useState("")
  const [filter, setFilter] = useState<InboxFilter>("all")
  const [inboxRefreshing, setInboxRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [draftConversationId, setDraftConversationId] = useState<string | null>(null)
  const lastScreenSendRef = useRef<{ key: string; at: number }>({ key: "", at: 0 })
  const [sending, setSending] = useState(false)
  const [windowSize, setWindowSize] = useState(MESSAGE_WINDOW)
  const [isOffline, setIsOffline] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyPreview, setReplyPreview] = useState<string | null>(null)
  const [peerPresence, setPeerPresence] = useState<PeerPresence | null>(null)
  const [threadContext, setThreadContext] = useState<{ type?: string; orderId?: string; listingId?: string } | null>(null)
  const [presenceSynced, setPresenceSynced] = useState(false)
  const typingActiveRef = useRef(false)
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const durablePreferred = isDurableMessagingEnabled()
  const bottomRef = useRef<HTMLDivElement>(null)
  const markedRef = useRef<string | null>(null)
  const pendingOpenRef = useRef<{ conversationId?: string; peerUserId?: string; kind?: string } | null>(null)


  useEffect(() => {
    const onPrefetch = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id === "messages") {
        try { window.dispatchEvent(new CustomEvent("ghc:messages-soft-revalidate")) } catch { /* */ }
      }
    }
    window.addEventListener("ghc:prefetch-tab", onPrefetch as EventListener)
    return () => window.removeEventListener("ghc:prefetch-tab", onPrefetch as EventListener)
  }, [])

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


  // Realtime-first message reconciliation. Push events trigger the open thread
  // immediately; the shared section coordinator owns focus/visibility/online recovery.
  useDomainEvents(["MESSAGE_CREATED", "MESSAGE_UPDATED", "MESSAGE_DELETED", "CONVERSATION_CREATED"], (event) => {
    const payload = event.payload
    const conversationId = String(
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? ((payload as Record<string, unknown>).conversationId || (payload as Record<string, unknown>).conversation_id || "")
        : "",
    ).trim()
    if (!selectedId || (conversationId && conversationId !== selectedId)) return
    void loadConversationMessages?.(selectedId).catch(() => {})
    void markConversationRead?.(selectedId)
  }, [selectedId, loadConversationMessages, markConversationRead])

  useSectionRefresh("messages", async () => {
    if (document.visibilityState === "hidden") return
    // Refresh open thread and keep inbox list current (names, unread, order)
    try {
      await ghc.refreshConversations?.()
    } catch { /* optional on context */ }
    try {
      await (ghc as { loadConversations?: () => Promise<unknown> }).loadConversations?.()
    } catch { /* */ }
    if (selectedId) {
      await loadConversationMessages?.(selectedId)
    }
  }, {
    minIntervalMs: 5_000,
    events: ["ghc:new-message", "ghc:messaging-reconcile", "ghc:messages-refresh"],
  })

  useEffect(() => {
    if (!selectedId) return
    const onVis = () => {
      if (document.visibilityState === "visible") {
        try {
          void markConversationRead?.(selectedId)
        } catch { /* */ }
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [selectedId, markConversationRead])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    ;(async () => {
      try {
        await loadConversationMessages?.(selectedId)
      } catch {
        /* */
      }
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, loadConversationMessages])

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
        setThreadContext(null)
        setWindowSize(MESSAGE_WINDOW)
      }
    }
    const resolvePeer = (peer: string) => {
      const rows = (conversations || []) as Array<{
        id?: string
        participantId?: string
        otherUserId?: string
        userId?: string
      }>
      const hit = rows.find((c) => {
        const p = String(c.participantId || c.otherUserId || c.userId || "")
        return p === peer
      })
      return hit?.id ? String(hit.id) : ""
    }
    const onOpenConversation = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      let id = String(detail.conversationId || "").trim()
      const peer = String(detail.peerUserId || detail.userId || "").trim()
      const kind = String(detail.kind || "").toLowerCase()
      const contextType = String(detail.contextType || detail.context || "").toLowerCase()
      const orderId = String(detail.orderId || "").trim() || undefined
      const listingId = String(detail.listingId || "").trim() || undefined
      if (!id && peer) id = resolvePeer(peer)
      if (!id) {
        // Conversations may not be loaded yet — retry when list updates
        pendingOpenRef.current = { conversationId: detail.conversationId, peerUserId: peer || undefined, kind }
        return
      }
      pendingOpenRef.current = null
      startTransition(() => {
        if (kind === "community" || kind === "group") {
          setFilter("communities")
        }
        if (contextType || orderId || listingId) {
          setThreadContext({ type: contextType || undefined, orderId, listingId })
        } else {
          setThreadContext(null)
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
  }, [conversations])

  // Flush deep-link open once conversations hydrate
  useEffect(() => {
    const pending = pendingOpenRef.current
    if (!pending) return
    let id = String(pending.conversationId || "").trim()
    const peer = String(pending.peerUserId || "").trim()
    if (!id && peer) {
      const hit = (conversations || []).find((c: { id?: string; participantId?: string; otherUserId?: string; userId?: string }) => {
        const p = String(c.participantId || c.otherUserId || c.userId || "")
        return p === peer
      })
      if (hit?.id) id = String(hit.id)
    }
    if (!id) return
    pendingOpenRef.current = null
    startTransition(() => {
      if (String(pending.kind || "").toLowerCase() === "community" || String(pending.kind || "").toLowerCase() === "group") {
        setFilter("communities")
      }
      setSelectedId(id)
      setDraft("")
      setWindowSize(MESSAGE_WINDOW)
      markedRef.current = null
    })
  }, [conversations])

  // Restore a conversation-specific draft instead of losing useful work when users move around the app.
  useEffect(() => {
    if (!selectedId || typeof window === "undefined") return
    try {
      const saved = window.localStorage.getItem(`ghc.message-draft.${selectedId}`) || ""
      setDraft(saved)
      setDraftConversationId(selectedId)
    } catch {
      setDraftConversationId(selectedId)
    }
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || draftConversationId !== selectedId || typeof window === "undefined") return
    const key = `ghc.message-draft.${selectedId}`
    try {
      if (draft.trim()) window.localStorage.setItem(key, draft)
      else window.localStorage.removeItem(key)
    } catch { /* storage is best-effort */ }
  }, [draft, selectedId, draftConversationId])

  const requestCount = useMemo(
    () => conversations.filter((c) => c && !c.isArchived && Boolean((c as Conversation & { isRequest?: boolean }).isRequest)).length,
    [conversations],
  )

  const unreadCount = useMemo(
    () =>
      conversations.filter(
        (c) => c && !c.isArchived && (c.unread || (c.unreadCount || 0) > 0),
      ).length,
    [conversations],
  )

  const communityConversationCount = useMemo(
    () => conversations.filter((c) => c && !c.isArchived && isCommunityConversation(c)).length,
    [conversations],
  )

  const relationshipOutcome = useMemo(
    () => buildRelationshipOutcome({
      unreadCount,
      requestCount,
      conversationCount: conversations.filter((c) => c && !c.isArchived).length,
      communityConversationCount,
      connectionCount: ghc.friends.length,
      matchCount: ghc.matches.length,
    }),
    [unreadCount, requestCount, conversations, communityConversationCount, ghc.friends.length, ghc.matches.length],
  )

  const list = useMemo(() => {
    const q = queryDebounced.trim().toLowerCase()
    // Build a peer lookup from session graph so inbox rows never show blank names/photos
    // when the conversation payload omitted display fields.
    const peerIndex = new Map<string, { name?: string; photo?: string }>()
    const indexPeer = (id: unknown, name?: unknown, photo?: unknown) => {
      const key = String(id || "").trim()
      if (!key) return
      const prev = peerIndex.get(key) || {}
      const n = typeof name === "string" && name.trim() ? name.trim() : prev.name
      const ph = typeof photo === "string" && photo.trim() ? photo.trim() : prev.photo
      peerIndex.set(key, { name: n, photo: ph })
    }
    try {
      for (const c of (ghc.candidates || []) as Array<Record<string, unknown>>) {
        indexPeer(c.id || c.userId, c.displayName || c.name, c.avatarUrl || c.photo || c.profilePhoto)
      }
      for (const f of (ghc.friends || []) as Array<Record<string, unknown> | string>) {
        if (typeof f === "string") continue
        indexPeer(f.id || f.userId, f.displayName || f.name, f.avatarUrl || f.photo || f.profilePhoto)
      }
      for (const m of (ghc.matches || []) as Array<Record<string, unknown> | string>) {
        if (typeof m === "string") continue
        indexPeer(m.id || m.userId, m.displayName || m.name, m.avatarUrl || m.photo || m.profilePhoto)
      }
    } catch {
      /* best-effort enrichment */
    }

    let rows = conversations.filter((c) => c && !c.isArchived).map((c) => {
      if (isCommunityConversation(c)) return c
      const peerId = String(c.participantId || (c as { otherUserId?: string }).otherUserId || "").trim()
      if (!peerId) return c
      const hit = peerIndex.get(peerId)
      if (!hit) return c
      const needsName =
        !c.participantName ||
        c.participantName === "User" ||
        c.participantName === "Unknown" ||
        c.participantName === peerId ||
        /^user[_-]/i.test(c.participantName)
      const needsPhoto = !c.participantPhoto && !c.groupPhoto
      if (!needsName && !needsPhoto) return c
      return {
        ...c,
        participantName: needsName && hit.name ? hit.name : c.participantName,
        participantPhoto: needsPhoto && hit.photo ? hit.photo : c.participantPhoto,
      }
    })
    if (filter === "unread") {
      rows = rows.filter((c) => Boolean(c.unread) || (c.unreadCount || 0) > 0)
    } else if (filter === "requests") {
      rows = rows.filter((c) => Boolean((c as Conversation & { isRequest?: boolean }).isRequest))
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
  }, [conversations, queryDebounced, filter, ghc.candidates, ghc.friends, ghc.matches])

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

  const stopTyping = useCallback(() => {
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current)
      typingIdleTimerRef.current = null
    }
    const wasTyping = typingActiveRef.current
    typingActiveRef.current = false
    if (wasTyping && selectedId) void apiTouchConversationPresence(selectedId, "stop_typing").catch(() => null)
  }, [selectedId])

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value)
    if (!selectedId || !value.trim()) {
      stopTyping()
      return
    }
    if (!typingActiveRef.current) {
      typingActiveRef.current = true
      void apiTouchConversationPresence(selectedId, "typing").catch(() => null)
    }
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current)
    typingIdleTimerRef.current = setTimeout(() => {
      typingActiveRef.current = false
      typingIdleTimerRef.current = null
      void apiTouchConversationPresence(selectedId, "stop_typing").catch(() => null)
    }, 1800)
  }, [selectedId, stopTyping])

  // Poll only while a thread is open. The server returns presence only for active
  // conversation members and expires online/typing leases automatically.
  useEffect(() => {
    if (!selectedId) {
      setPeerPresence(null)
      setPresenceSynced(false)
      return
    }
    setPeerPresence(null)
    setPresenceSynced(false)
    let disposed = false
    let inFlight = false
    const syncPresence = async () => {
      if (disposed || inFlight || document.visibilityState !== "visible") return
      inFlight = true
      try {
        const response = await apiTouchConversationPresence(selectedId, typingActiveRef.current ? "typing" : "heartbeat")
        if (!disposed && response?.ok && Array.isArray(response.presence)) {
          const peerId = selected?.participantId
          const peer = (response.presence as PeerPresence[]).find((item) => item.userId === peerId) || (response.presence as PeerPresence[])[0] || null
          setPeerPresence(peer)
          setPresenceSynced(true)
        }
      } catch { /* Presence must never block sending or reading messages. */ }
      finally { inFlight = false }
    }
    void syncPresence()
    const interval = window.setInterval(() => void syncPresence(), 5000)
    return () => {
      disposed = true
      window.clearInterval(interval)
      stopTyping()
    }
  }, [selectedId, selected?.participantId, stopTyping])

  useEffect(() => {
    if (!selectedId) return
    const markRead = () => {
      if (document.visibilityState === "visible") void markConversationRead?.(selectedId)
    }
    window.addEventListener("focus", markRead)
    return () => window.removeEventListener("focus", markRead)
  }, [selectedId, markConversationRead])

  const messages: Message[] = useMemo(() => {
    if (allMessages.length <= windowSize) return allMessages
    return allMessages.slice(-windowSize)
  }, [allMessages, windowSize])

  useEffect(() => {
    if (!selectedId || selected?.id !== selectedId || markedRef.current === selectedId) return
    markedRef.current = selectedId
    try { void markConversationRead?.(selectedId) } catch { /* */ }
  }, [selectedId, selected?.id, markConversationRead])

  useEffect(() => {
    if (!selectedId) return
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
    })
    return () => cancelAnimationFrame(id)
  }, [selectedId, messages.length])

  const openThread = useCallback((id: string) => {
    stopTyping()
    startTransition(() => {
      setSelectedId(id)
      setDraft("")
      try { window.localStorage.removeItem(`ghc.message-draft.${selectedId}`) } catch { /* */ }
      setReplyToId(null)
      setReplyPreview(null)
      setWindowSize(MESSAGE_WINDOW)
      markedRef.current = null
    })
    // Heal community/group membership before the user tries to send
    try {
      const conv = (rawConversations || []).find((c) => c.id === id)
      const groupish =
        conv?.conversationType === "group" ||
        (conv as { kind?: string; isCommunity?: boolean; communityId?: string } | undefined)?.kind === "community" ||
        Boolean((conv as { communityId?: string } | undefined)?.communityId) ||
        id.startsWith("comm_")
      if (groupish) {
        void apiEnsureConversationMember(id, conv?.groupName || conv?.participantName).catch(() => {})
      }
    } catch {
      /* */
    }
  }, [stopTyping, rawConversations])

  const closeThread = useCallback(() => {
    stopTyping()
    startTransition(() => {
      setSelectedId(null)
      setDraft("")
      setReplyToId(null)
      setReplyPreview(null)
      setWindowSize(MESSAGE_WINDOW)
    })
  }, [stopTyping])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || !selectedId || sending) return
    const dedupeKey = `${selectedId}:${text}`
    const now = Date.now()
    if (lastScreenSendRef.current.key === dedupeKey && now - lastScreenSendRef.current.at < 1500) {
      return
    }
    lastScreenSendRef.current = { key: dedupeKey, at: now }
    setSending(true)
    setDraft("")
    stopTyping()
    const replyingTo = replyToId
    setReplyToId(null)
    setReplyPreview(null)
    try {
      const accepted = replyingTo
        ? await replyToMessage(selectedId, replyingTo, text)
        : await sendMessage?.(selectedId, text)
      if (accepted === false || accepted === undefined) {
        setDraft(text)
        if (replyingTo) {
          setReplyToId(replyingTo)
          const parent = allMessages.find((m) => m.id === replyingTo)
          setReplyPreview((parent?.text || "").slice(0, 80))
        }
        toastError(
          isOffline
            ? "You are offline. Message kept — send again when online."
            : "Message could not be delivered. If this is a community chat, open Communities and rejoin, then try again."
        )
        return
      }
      setStatusMsg(isOffline ? "Queued — will sync when online" : "Message sent")
      window.setTimeout(() => setStatusMsg(null), 2000)
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      })
    } catch {
      // Restore draft and reply context so the user can retry safely.
      setDraft(text)
      if (replyingTo) {
        setReplyToId(replyingTo)
        const parent = allMessages.find((m) => m.id === replyingTo)
        setReplyPreview((parent?.text || "").slice(0, 80))
      }
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:toast", {
            detail: {
              message: isOffline
                ? "You are offline. Message kept in the composer — send again when online."
                : userFacingError("FORBIDDEN", "Message couldn't be confirmed. Check your connection and try again."),
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
  }, [draft, selectedId, sending, sendMessage, replyToMessage, replyToId, isOffline, allMessages, stopTyping])

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
      <div className="gh-world-messages gh-messages-shell flex h-full min-h-0 flex-col bg-background text-foreground contain-content" role="region" aria-label="Conversation thread">
        <ChatHeader
          participantName={selected.groupName || selected.participantName || "Chat"}
          participantPhoto={selected.groupPhoto || selected.participantPhoto || ""}
          isOnline={presenceSynced ? Boolean(peerPresence?.online) : Boolean(selected.online)}
          isTyping={presenceSynced ? Boolean(peerPresence?.isTyping) : Boolean(selected.isTyping)}
          lastSeenLabel={presenceSynced ? formatLastSeen(peerPresence?.lastSeenAt) : "Last seen unavailable"}
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
              {threadContext?.type === "marketplace_order" || threadContext?.orderId ? (
                <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100">
                  <p className="font-bold">Marketplace order chat</p>
                  <p className="opacity-90">
                    Coordinate delivery here. Payments stay in Orders / wallet — this thread is messaging only.
                    {threadContext.orderId ? ` · Order ${threadContext.orderId.slice(0, 10)}…` : ""}
                  </p>
                </div>
              ) : null}


        <div className="sr-only" role="status" aria-live="polite">
          {statusMsg || (sending ? "Sending message" : "")}
        </div>

        {isOffline ? (
          <div
            className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            You are offline. Messages will queue and send automatically when you reconnect.
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
                        if (!msg.text || !selectedId || sending) return
                        void (async () => {
                          setSending(true)
                          setStatusMsg("Retrying…")
                          try {
                            const accepted = await sendMessage?.(selectedId, msg.text, msg.replyTo)
                            if (accepted) {
                              setStatusMsg("Sent")
                              window.setTimeout(() => setStatusMsg(null), 1500)
                            } else {
                              setDraft(msg.text)
                              setStatusMsg("Retry not confirmed — edit and send again")
                              window.setTimeout(() => setStatusMsg(null), 2500)
                            }
                          } catch {
                            setDraft(msg.text)
                            setStatusMsg("Retry failed — edit and send again")
                            window.setTimeout(() => setStatusMsg(null), 2500)
                          } finally {
                            setSending(false)
                          }
                        })()
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
            onMessageChange={handleDraftChange}
            onSendMessage={() => void handleSend()}
            onEmojiClick={() => {
              /* MessageInput owns the emoji sheet */
            }}
            onAttachmentClick={() => {
              try {
                const input = document.createElement("input")
                input.type = "file"
                input.accept = "image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
                input.multiple = true
                input.onchange = async () => {
                  const files = Array.from(input.files || []).slice(0, 4)
                  if (!files.length || !selectedId) return
                  try {
                    const { uploadDurableMedia, mediaUploadErrorMessage } = await import("@/lib/media/upload-client")
                    for (const file of files) {
                      const kind = file.type.startsWith("image/")
                        ? "image"
                        : file.type.startsWith("video/")
                          ? "video"
                          : "file"
                      const up = await uploadDurableMedia(file, {
                        category: file.type.startsWith("image/")
                          ? "images"
                          : file.type.startsWith("video/")
                            ? "videos"
                            : file.type.startsWith("audio/")
                              ? "audio"
                              : "documents",
                        onProgress: (label) => {
                          try {
                            window.dispatchEvent(
                              new CustomEvent("ghc:toast", {
                                detail: { message: String(label || "Uploading…"), type: "info" },
                              })
                            )
                          } catch { /* */ }
                        },
                      })
                      if (!up.ok || !("url" in up && up.url)) {
                        const failMsg =
                          !up.ok
                            ? mediaUploadErrorMessage(up)
                            : "Upload failed"
                        window.dispatchEvent(
                          new CustomEvent("ghc:toast", {
                            detail: {
                              message: failMsg,
                              type: "error",
                            },
                          })
                        )
                        continue
                      }
                      if (typeof sendMediaMessage === "function") {
                        await sendMediaMessage(selectedId, up.url, kind as "image" | "video" | "file", file.name)
                      }
                    }
                  } catch {
                    try {
                      window.dispatchEvent(
                        new CustomEvent("ghc:toast", {
                          detail: { message: "Could not attach media", type: "error" },
                        })
                      )
                    } catch { /* */ }
                  }
                }
                input.click()
              } catch { /* */ }
            }}
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
    { id: "requests", label: "Requests", count: requestCount },
    { id: "communities", label: "Communities" },
  ]


  return (
    <div className="gh-world-messages gh-world-inbox flex h-full min-h-0 flex-col bg-background text-foreground contain-content" role="region" aria-label="Messages inbox">
      <div className="px-3 pt-2" role="status">
        {isOffline ? (
          <p className="rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Offline — existing conversations remain available where cached. Reconnect before sending new messages or attachments.
          </p>
        ) : null}
      </div>
      <header className="shrink-0 border-b border-border/50 bg-card/95 px-3 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[17px] font-bold tracking-tight text-foreground">Messages</h1>
            <p className="text-[11px] text-muted-foreground">
              People, requests and community conversations in one place
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

        <section className="mt-2.5 rounded-[1.15rem] border border-border/60 bg-background/75 p-3 shadow-sm" aria-label="Relationship action centre">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/50">
              {relationshipOutcome.tone === "attention" ? <MessageCircle size={15} aria-hidden /> : relationshipOutcome.tone === "progress" ? <Sparkles size={15} aria-hidden /> : <ShieldCheck size={15} aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-extrabold text-foreground">{relationshipOutcome.title}</p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{relationshipOutcome.badge}</span>
              </div>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{relationshipOutcome.detail}</p>
              <button type="button" onClick={() => relationshipOutcome.action === "requests" ? setFilter("requests") : relationshipOutcome.action === "unread" ? setFilter("unread") : relationshipOutcome.action === "communities" ? setFilter("communities") : navigateTo("discover")} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--gh-green)] px-3 text-[10.5px] font-bold text-white shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                {relationshipOutcome.actionLabel}<ArrowRight size={12} aria-hidden />
              </button>
            </div>
          </div>
        </section>

        <div
          className="mt-2 flex gap-1 rounded-2xl border border-border/50 bg-muted/50 p-1"
          role="tablist"
          aria-label="Inbox filters"
          onKeyDown={(e) => {
            const order: InboxFilter[] = ["all", "dms", "unread", "requests", "communities"]
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
              className={`flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-[11px] font-bold transition active:scale-[0.98] ${
                filter === f.id
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
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
        onTouchStart={(e) => {
          const el = e.currentTarget
          if (el.scrollTop <= 0) (el as HTMLElement & { _pullY?: number })._pullY = e.touches[0]?.clientY
        }}
        onTouchEnd={(e) => {
          const el = e.currentTarget as HTMLElement & { _pullY?: number }
          const start = el._pullY
          el._pullY = undefined
          if (start == null || el.scrollTop > 0 || inboxRefreshing) return
          const dy = (e.changedTouches[0]?.clientY || 0) - start
          if (dy < 72) return
          setInboxRefreshing(true)
          void (async () => {
            try {
              await ghc.refreshConversations?.()
            } catch { /* */ }
            try {
              await (ghc as { loadConversations?: () => Promise<unknown> }).loadConversations?.()
            } catch { /* */ }
            try {
              window.dispatchEvent(new CustomEvent("ghc:messages-refresh", { detail: { reason: "pull" } }))
            } catch { /* */ }
            setInboxRefreshing(false)
          })()
        }}
      >
        {inboxRefreshing ? (
          <p className="px-3 py-1.5 text-center text-[11px] font-medium text-muted-foreground">Refreshing inbox…</p>
        ) : null}
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
          ) : filter === "requests" ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-[14px] font-bold">No message requests</p>
              <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-muted-foreground">
                New conversations from people outside your accepted network will stay separated here so your main inbox remains focused.
              </p>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-3 rounded-full border border-border bg-card px-4 py-2 text-[12px] font-bold text-foreground shadow-sm"
              >
                Back to inbox
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
            {requestCount > 0 && filter === "all" ? ` · ${requestCount} request${requestCount === 1 ? "" : "s"}` : ""}
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
