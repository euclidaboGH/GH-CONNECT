"use client"

import { useState, useMemo, useRef, useCallback, memo, type KeyboardEvent } from "react"
import { Send, Smile, Paperclip, X, Search, MessageCircle, Pin, Archive, VolumeX, FileText, Play, Phone, Video } from "lucide-react"
import type { Conversation } from "@/lib/ghc-types"
import { timeAgo } from "@/lib/ghc-data"
import { LazyImage } from "./lazy-image"
// Import for re-export: enhanced group message component available
// Use EnhancedGroupMessage from '@/components/ghc/enhanced-group-message' for group chats
// This file preserves private message components and maintains separation of concerns

// Empty state when no conversations exist
export function EmptyMessagesState({
  onNavigateToMatches,
  onNavigateToFind,
  hasMatches = false,
  hasConnections = false,
}: {
  onNavigateToMatches: () => void
  onNavigateToFind?: () => void
  /** Only show icebreakers when user already has a match or connection */
  hasMatches?: boolean
  hasConnections?: boolean
}) {
  const canIcebreak = hasMatches || hasConnections
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <div className="relative mb-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40" aria-hidden="true">
          <MessageCircle size={40} className="text-emerald-600" />
        </div>
      </div>
      <h3 className="mb-2 text-lg font-bold text-foreground">No messages yet</h3>
      <p className="mb-4 max-w-xs text-sm text-muted-foreground">
        {canIcebreak
          ? "Say hello to someone you’ve matched or connected with."
          : "Message people you’ve matched or connected with. Strangers stay under Requests until you accept."}
      </p>

      {canIcebreak ? (
        <div className="mb-5 w-full max-w-xs space-y-1.5 text-left">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Icebreaker ideas
          </p>
          {[
            "You matched — what’s one goal you’re focused on this month?",
            "Loved your profile note about mentoring. Mind if I ask one question?",
            "We share a community — any tips for someone just joining?",
          ].map((line) => (
            <p
              key={line}
              className="rounded-xl border border-border bg-card px-3 py-2 text-[12px] leading-snug text-foreground"
            >
              “{line}”
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          type="button"
          onClick={onNavigateToMatches}
          className="w-full rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          Open Matches
        </button>
        <button
          type="button"
          onClick={() => {
            if (onNavigateToFind) onNavigateToFind()
            else window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "discover" }))
          }}
          className="w-full rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted active:scale-[0.98]"
        >
          Find people
        </button>
      </div>
      <p className="mt-4 max-w-xs text-[11px] text-muted-foreground">
        Requests folder holds messages from people you don’t connect with yet.
      </p>
    </div>
  )
}


export function ConversationSearchBar({ searchQuery, onSearchChange }: { searchQuery: string; onSearchChange: (query: string) => void }) {
  return (
    <div className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-3 py-2.5 backdrop-blur-sm">
      <div className="relative flex items-center">
        <Search size={18} className="absolute left-3 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search name or last message…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="min-h-11 w-full rounded-2xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange("")} className="absolute right-3 text-gray-500 hover:text-gray-700 active:scale-90 transition">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

// Individual conversation list item with actions - optimized rendering
export function ConversationItem({
  conversation,
  isSelected,
  onClick,
  onPin,
  onArchive,
  onMute,
  onOpenProfile,
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onPin?: (conversationId: string) => void
  onArchive?: (conversationId: string) => void
  onMute?: (conversationId: string) => void
  onOpenProfile?: () => void
}) {
  const hasUnread = conversation.unread || Boolean(conversation.unreadCount)
  const unreadCount = conversation.unreadCount || (conversation.unread ? 1 : 0)
  const messagePreview = useMemo(() => {
    if (conversation.isTyping) return `${conversation.typingUser || conversation.participantName} is typing…`
    if (!conversation.lastMessage) return "Start a conversation"
    return conversation.lastMessage.length > 54 ? `${conversation.lastMessage.substring(0, 54)}…` : conversation.lastMessage
  }, [conversation.lastMessage, conversation.isTyping, conversation.typingUser, conversation.participantName])
  const timestamp = conversation.lastMessageTime ? timeAgo(conversation.lastMessageTime) : ""

  return (
    <div className={`group border-b border-gray-50 transition-colors ${isSelected ? "bg-emerald-50/60" : "bg-white hover:bg-gray-50"}`}>
      <button onClick={onClick} className="flex min-h-[68px] w-full items-center px-3.5 py-2.5 text-left transition active:bg-emerald-50/50 sm:px-4" aria-label={`Open conversation with ${conversation.participantName}`}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenProfile?.() }} className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label={`Open ${conversation.participantName}'s profile`}>
              <LazyImage
                src={conversation.participantPhoto}
                alt={`${conversation.participantName} profile photo`}
                className="h-12 w-12 rounded-full bg-gray-100 object-cover ring-1 ring-black/5"
              />
            </button>
            <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${conversation.online ? "bg-emerald-500" : "bg-gray-300"}`} aria-label={conversation.online ? "Online" : "Offline"} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={`min-w-0 flex-1 truncate text-[15px] text-gray-950 ${hasUnread ? "font-semibold" : "font-medium"}`}>
                {(conversation.conversationType === "group" || (conversation as { isCommunity?: boolean }).isCommunity)
                  ? `Community · ${conversation.groupName || conversation.participantName}`
                  : conversation.participantName}
                {(conversation as { isRequest?: boolean }).isRequest ? (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">Request</span>
                ) : conversation.conversationType === "group" || (conversation as { isCommunity?: boolean }).isCommunity ? (
                  <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800">Community</span>
                ) : (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">DM</span>
                )}
              </p>
              <time dateTime={conversation.lastMessageTime ? new Date(conversation.lastMessageTime).toISOString() : undefined} className={`shrink-0 text-[11px] ${hasUnread ? "font-bold text-emerald-600" : "text-gray-400"}`}>
                {timestamp}
              </time>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p className={`min-w-0 flex-1 truncate text-[13px] ${conversation.isTyping ? "font-semibold text-emerald-600" : hasUnread ? "font-medium text-gray-800" : "text-gray-500"}`}>
                {messagePreview}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {conversation.isPinned && <Pin size={13} className="text-blue-500" aria-label="Pinned" />}
                {conversation.isArchived && <Archive size={13} className="text-gray-400" aria-label="Archived" />}
                {conversation.isMuted && <VolumeX size={13} className="text-gray-400" aria-label="Muted" />}
                {hasUnread && (
                  unreadCount > 1 ? (
                    <span className="flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-label="Unread" />
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      <div className="hidden gap-2 border-t border-gray-50 px-3 py-1.5 transition group-hover:flex">
        {onPin && <button onClick={(e) => { e.stopPropagation(); onPin(conversation.id) }} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100" title={conversation.isPinned ? "Unpin" : "Pin"}><Pin size={12} />{conversation.isPinned ? "Unpin" : "Pin"}</button>}
        {onArchive && <button onClick={(e) => { e.stopPropagation(); onArchive(conversation.id) }} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200" title={conversation.isArchived ? "Unarchive" : "Archive"}><Archive size={12} />{conversation.isArchived ? "Unarchive" : "Archive"}</button>}
        {onMute && <button onClick={(e) => { e.stopPropagation(); onMute(conversation.id) }} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200" title={conversation.isMuted ? "Unmute" : "Mute"}><VolumeX size={12} />{conversation.isMuted ? "Unmute" : "Mute"}</button>}
      </div>
    </div>
  )
}

// Memoized emoji picker - prevent re-renders

const COMMON_EMOJIS = ["😀", "😂", "❤️", "👍", "🔥", "😍", "👏", "🎉", "💯", "🙏"]

const EmojiPickerGrid = memo(({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) => (
  <div className="mb-3 p-3 bg-gray-50 rounded-lg grid grid-cols-10 gap-2">
    {COMMON_EMOJIS.map((emoji) => (
      <button
        key={emoji}
        onClick={() => onEmojiSelect(emoji)}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition hover:bg-white active:scale-110"
      >
        {emoji}
      </button>
    ))}
  </div>
))
EmojiPickerGrid.displayName = "EmojiPickerGrid"

export function MessageInput({
  messageText,
  onMessageChange,
  onSendMessage,
  onEmojiClick,
  onAttachmentClick,
  disabled,
}: {
  messageText: string
  onMessageChange: (text: string) => void
  onSendMessage: () => void
  onEmojiClick: () => void
  onAttachmentClick: () => void
  disabled: boolean
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const handleEmojiSelect = useCallback((emoji: string) => {
    onMessageChange(messageText + emoji)
    setShowEmojiPicker(false)
  }, [messageText, onMessageChange])

  const handleKeyPress = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSendMessage()
    }
  }, [onSendMessage])

  const toggleEmojiPicker = useCallback(() => {
    setShowEmojiPicker(prev => !prev)
  }, [])

  return (
    <div className="relative z-40 min-w-0 shrink-0 border-t border-gray-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {/* Emoji picker - only renders when visible */}
      {showEmojiPicker && <EmojiPickerGrid onEmojiSelect={handleEmojiSelect} />}

      {/* Input area */}
      <div className="flex min-w-0 items-end gap-2">
        {/* Emoji button */}
        <button
          onClick={toggleEmojiPicker}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition hover:bg-muted/80 active:scale-90"
          title="Add emoji"
        >
          <Smile size={20} />
        </button>

        {/* Message input */}
        <textarea
          value={messageText}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message…"
          className="min-h-11 min-w-0 max-h-[120px] flex-1 resize-none rounded-2xl border border-border bg-muted px-3 py-2.5 text-[15px] leading-[1.45] transition focus:border-emerald-400 focus:bg-card focus:outline-none focus:ring-2 focus:ring-emerald-100"
          rows={1}
          style={{ minHeight: "44px", maxHeight: "120px" }}
        />

        {/* Attachment button */}
        <button
          onClick={onAttachmentClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition hover:bg-muted/80 active:scale-90"
          title="Attach file"
        >
          <Paperclip size={20} />
        </button>

        {/* Send button */}
        <button
          onClick={onSendMessage}
          disabled={!messageText.trim() || disabled}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white transition hover:bg-emerald-700 active:scale-90 disabled:bg-muted disabled:text-muted-foreground"
          title="Send message"
        >
          <Send size={20} />
        </button>
      </div>

      <p className="mt-1.5 text-[10px] text-muted-foreground">Enter to send</p>
    </div>
  )
}

// Enhanced message bubble with long-press actions (mobile) + hover actions (desktop)
export function MessageBubble({
  message,
  isSentByCurrentUser,
  onReply,
  onForward,
  onReact,
  onDelete,
  onReport,
  onCopy,
  onRetry,
}: {
  message: {
    id: string
    text: string
    senderId: string
    createdAt: number
    replyTo?: string
    replyToPreview?: { senderName: string; text: string }
    reactions?: Record<string, string[]>
    isEdited?: boolean
    isPinned?: boolean
    isDeleted?: boolean
    deletedForEveryone?: boolean
    mediaAttachments?: any[]
    status?: "sending" | "sent" | "delivered" | "read" | "failed" | "deleted"
  }
  isSentByCurrentUser: boolean
  onReply?: (messageId: string) => void
  onForward?: (messageId: string) => void
  onReact?: (messageId: string, emoji: string) => void
  /** deleteForEveryone=true when sender chooses "Delete for everyone" within the allowed window */
  onDelete?: (messageId: string, deleteForEveryone?: boolean) => void
  onReport?: (messageId: string) => void
  onCopy?: (text: string) => void
  onRetry?: (messageId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const timestamp = useMemo(
    () => new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [message.createdAt]
  )

  const reactionEmojis = useMemo(() => ["😀", "😂", "❤️", "👍", "😢", "😡"], [])

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startLongPress = () => {
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true)
    }, 450)
  }

  const copyText = () => {
    const text = message.text || ""
    if (onCopy) onCopy(text)
    else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
    }
    setMenuOpen(false)
  }

  return (
    <div className={`mb-3 flex ${isSentByCurrentUser ? "justify-end" : "justify-start"}`}>
      <div className="group relative">
        {/* Pinned indicator */}
        {message.isPinned && (
          <div className="text-xs text-blue-600 mb-1 px-2">📌 Pinned</div>
        )}
        
        {/* Reply preview if replying to another message */}
        {message.replyTo && message.replyToPreview && (
          <div className={`text-xs px-3 py-1 mb-1 rounded border-l-2 ${
            isSentByCurrentUser ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-300 bg-gray-50 text-gray-600"
          }`}>
            <p className="font-semibold">{message.replyToPreview.senderName}</p>
            <p className="truncate opacity-75">{message.replyToPreview.text}</p>
          </div>
        )}

        {(message as any).isDeleted || (message as any).isDeletedForEveryone || (message as any).deletedForEveryone ? (
          <div
            className={`max-w-[min(82vw,24rem)] px-4 py-2.5 rounded-2xl text-sm italic shadow-sm ${
              isSentByCurrentUser ? "bg-emerald-100 text-emerald-700 rounded-br-none" : "bg-gray-100 text-gray-500 rounded-bl-none"
            }`}
          >
            This message was deleted
          </div>
        ) : (
        <div
          role="button"
          tabIndex={0}
          onTouchStart={startLongPress}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenuOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setMenuOpen(true)
          }}
          className={`group max-w-[min(82vw,24rem)] cursor-pointer select-none rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
            isSentByCurrentUser ? "rounded-br-none border border-emerald-600/30 bg-emerald-600/15 text-emerald-950 dark:bg-emerald-600/25 dark:text-emerald-50" : "rounded-bl-none bg-muted text-foreground"
          }`}
        >
          {message.mediaAttachments?.length ? (
            <div className="mb-2 space-y-2">
              {message.mediaAttachments.map((media) => (
                <div key={media.id} className="overflow-hidden rounded-xl bg-black/5">
                  {media.type === "image" || media.type === "video" ? (
                    <div className="relative">
                      <img src={media.thumbnail || media.url} alt={media.fileName || "Message attachment"} loading="lazy" decoding="async" className="max-h-56 w-full rounded-xl object-cover" onError={(event) => { event.currentTarget.style.display = "none" }} />
                      {media.type === "video" && <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/55 p-2 text-white"><Play size={16} fill="currentColor" /></span></span>}
                    </div>
                  ) : media.type === "file" ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs"><FileText size={16} /><span className="truncate">{media.fileName || "Attached file"}</span></div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs"><VolumeX size={16} /><span>Voice message</span></div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {message.text && <p className="break-words">{message.text}</p>}
          {(message as any).sharedPostId && (
            <div className={`mt-2 rounded-xl border px-3 py-2 text-xs ${isSentByCurrentUser ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-50" : "border-gray-300 bg-white text-gray-700"}`}>
              <p className="font-bold">Shared post</p>
              <p className="opacity-80">View original in feed · ref {(message as any).sharedPostId.slice(0, 8)}…</p>
            </div>
          )}
          <p className={`mt-1 text-xs opacity-70 ${isSentByCurrentUser ? "text-emerald-100" : "text-gray-600"}`}>
            {timestamp}
            {message.status === "failed" && isSentByCurrentUser && (
          <div className="mt-1 flex items-center justify-end gap-2 px-1">
            <span className="text-[10px] font-semibold text-red-600">Not delivered</span>
            {onRetry && (
              <button
                type="button"
                className="min-h-8 rounded-full bg-red-50 px-2.5 text-[10px] font-bold text-red-700 dark:bg-red-950/40"
                onClick={() => onRetry(message.id)}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {message.status === "sending" && isSentByCurrentUser && (
          <p className="mt-0.5 text-right text-[10px] text-muted-foreground">Queued · sending…</p>
        )}
        {message.isEdited && " (edited)"}
          </p>
        </div>
        )}

        {/* Reactions display */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-2">
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <div
                key={emoji}
                className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                  isSentByCurrentUser
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <span>{emoji}</span>
                <span className="text-xs font-semibold">{users.length}</span>
              </div>
            ))}
          </div>
        )}

        {/* Desktop hover actions */}
        <div
          className={`mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100 ${
            isSentByCurrentUser ? "justify-end" : "justify-start"
          }`}
        >
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(message.id)}
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-200"
            >
              Reply
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-200"
          >
            More
          </button>
        </div>

        {/* Long-press / More action sheet */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-end bg-black/40 sm:items-center sm:justify-center"
            role="dialog"
            aria-modal="true"
            onClick={() => setMenuOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-t-2xl bg-white p-2 shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Message actions
              </p>
              {onReact && (
                <div className="mb-1 flex gap-1 px-2 pb-2">
                  {reactionEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onReact(message.id, emoji)
                        setMenuOpen(false)
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-lg hover:bg-gray-100"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              {onReply && (
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  onClick={() => {
                    onReply(message.id)
                    setMenuOpen(false)
                  }}
                >
                  Reply
                </button>
              )}
              <button
                type="button"
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
                onClick={copyText}
              >
                Copy
              </button>
              {onForward && (
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  onClick={() => {
                    onForward(message.id)
                    setMenuOpen(false)
                  }}
                >
                  Forward
                </button>
              )}
              {onDelete && (
                <>
                  <button
                    type="button"
                    className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    onClick={() => {
                      onDelete(message.id, false)
                      setMenuOpen(false)
                    }}
                  >
                    Delete for me
                  </button>
                  {isSentByCurrentUser && Date.now() - message.createdAt <= 60 * 60 * 1000 && (
                    <button
                      type="button"
                      className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                      onClick={() => {
                        onDelete(message.id, true)
                        setMenuOpen(false)
                      }}
                    >
                      Delete for everyone
                    </button>
                  )}
                </>
              )}
              {!isSentByCurrentUser && onReport && (
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  onClick={() => {
                    onReport(message.id)
                    setMenuOpen(false)
                  }}
                >
                  Report
                </button>
              )}
              <button
                type="button"
                className="mt-1 w-full rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800"
                onClick={() => setMenuOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Chat header with participant info + presence / last-seen
export function ChatHeader({
  participantName,
  participantPhoto,
  isOnline,
  isTyping = false,
  lastSeenLabel,
  onBack,
  onCall,
  onVideo,
  onOpenProfile,
  onBlock,
  onReport,
  isCommunity = false,
}: {
  participantName: string
  participantPhoto: string
  isOnline: boolean
  isTyping?: boolean
  lastSeenLabel?: string
  onBack: () => void
  onCall?: () => void
  onVideo?: () => void
  onOpenProfile?: () => void
  onBlock?: () => void
  onReport?: () => void
  isCommunity?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onBack} className="shrink-0 text-sm font-semibold text-muted-foreground" aria-label="Back">
          ←
        </button>
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 items-center gap-3 text-left transition active:scale-[0.98]"
        >
          <div className="relative shrink-0">
            <img
              src={participantPhoto || "/placeholder.svg?width=80&height=80"}
              alt=""
              loading="eager"
              decoding="async"
              className="h-12 w-12 rounded-full object-cover shadow-sm ring-1 ring-black/5"
              onError={(event) => {
                event.currentTarget.src = "/placeholder.svg?width=80&height=80"
              }}
            />
            {isOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              {participantName.startsWith("Community ·") ? participantName : isCommunity ? `Community · ${participantName}` : participantName}
            </p>
            <p className={`text-[12px] ${isTyping ? "font-semibold text-emerald-600" : "text-muted-foreground"}`}>
              {isTyping ? "Typing…" : isOnline ? "Active now" : lastSeenLabel || "Offline"}
            </p>
          </div>
        </button>
      </div>

      <div className="relative flex items-center gap-0.5">
        {onCall && !isCommunity && (
          <button
            type="button"
            onClick={onCall}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
            aria-label="Voice call"
            title="Voice call"
          >
            <Phone size={20} strokeWidth={2} />
          </button>
        )}
        {onVideo && !isCommunity && (
          <button
            type="button"
            onClick={onVideo}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
            aria-label="Video call"
            title="Video call"
          >
            <Video size={20} strokeWidth={2} />
          </button>
        )}
        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="hidden rounded-full bg-muted px-2.5 py-1.5 text-[11px] font-bold text-foreground sm:inline-flex"
          >
            Profile
          </button>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80"
          aria-label="Chat safety menu"
          aria-expanded={menuOpen}
        >
          ···
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-12 z-30 w-48 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-lg">
            {onOpenProfile && (
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-[12px] font-semibold text-foreground hover:bg-muted sm:hidden"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenProfile()
                }}
              >
                View profile
              </button>
            )}
            {onReport && (
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-[12px] font-semibold text-foreground hover:bg-muted"
                onClick={() => {
                  setMenuOpen(false)
                  onReport()
                }}
              >
                Report
              </button>
            )}
            {onBlock && (
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false)
                  onBlock()
                }}
              >
                Block
              </button>
            )}
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted"
              onClick={() => setMenuOpen(false)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
