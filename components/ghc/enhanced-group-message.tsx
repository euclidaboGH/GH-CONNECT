"use client"

import { useState, useMemo, memo } from "react"
import { Heart, MessageCircle, Pin, MoreVertical, Download, Copy, Reply } from "lucide-react"
import type { Message } from "@/lib/ghc-types"

interface EnhancedGroupMessageProps {
  message: Message
  previousMessage?: Message
  nextMessage?: Message
  senderName: string
  senderPhoto?: string
  isCurrentUser?: boolean
  isPinned?: boolean
  onReply?: (messageId: string) => void
  onReact?: (messageId: string, emoji: string) => void
  onPin?: (messageId: string) => void
  onEdit?: (messageId: string, newText: string) => void
  onDelete?: (messageId: string) => void
  highlightId?: string
}

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🎉", "🔥"]

// Check if messages should be grouped (same sender, within 5 minutes)
function shouldGroupMessages(current?: Message, previous?: Message): boolean {
  if (!previous || !current) return false
  return (
    previous.senderId === current.senderId &&
    current.createdAt - previous.createdAt < 300000 // 5 minutes
  )
}

// Format time efficiently
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

  if (diffMinutes < 1) return "now"
  if (diffMinutes < 60) return `${diffMinutes}m`
  if (diffMinutes < 1440) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return date.toLocaleDateString()
}

type MessageAttachment = NonNullable<Message["mediaAttachments"]>[number]

// Media attachment renderer
function MediaAttachment({
  attachment,
}: {
  attachment?: MessageAttachment | null
}) {
  if (!attachment) return null

  switch (attachment.type) {
    case "image":
      return (
        <div className="relative group mt-2 rounded-lg overflow-hidden max-w-xs">
          <img
            src={attachment.url}
            alt="Attachment"
            loading="lazy"
            className="max-w-full h-auto rounded-lg"
          />
          <button
            className="absolute top-2 right-2 p-1.5 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity"
            title="Download"
          >
            <Download size={16} className="text-white" />
          </button>
        </div>
      )
    case "voice":
      return (
        <div className="mt-2 flex items-center gap-2 bg-muted p-2 rounded-lg max-w-xs">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-1 bg-muted-foreground/30 rounded-full">
              <div className="h-full w-1/3 bg-primary rounded-full" />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {attachment.duration ? `${Math.round(attachment.duration)}s` : "Voice note"}
            </div>
          </div>
        </div>
      )
    case "file":
      return (
        <div className="mt-2 flex items-center gap-2 bg-muted p-2 rounded-lg max-w-xs">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-foreground">
              {attachment.fileName || "File"}
            </div>
            <div className="text-xs text-muted-foreground">
              {attachment.size ? `${(attachment.size / 1024).toFixed(1)}KB` : ""}
            </div>
          </div>
          <button className="p-1 hover:bg-background rounded transition-colors flex-shrink-0">
            <Download size={16} className="text-muted-foreground" />
          </button>
        </div>
      )
    default:
      return null
  }
}

// Reaction pill component - memoized for performance
const ReactionPill = memo(function ReactionPill({
  emoji,
  count,
  userReacted,
  onClick,
}: {
  emoji: string
  count: number
  userReacted: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-full text-sm font-medium transition-colors ${
        userReacted
          ? "bg-primary/20 text-primary border border-primary/30"
          : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
      }`}
    >
      {emoji} {count}
    </button>
  )
})

const EnhancedGroupMessageComponent = ({
  message,
  previousMessage,
  nextMessage,
  senderName,
  senderPhoto,
  isCurrentUser,
  isPinned: messagePinned,
  onReply,
  onReact,
  onPin,
  onEdit,
  onDelete,
  highlightId,
}: EnhancedGroupMessageProps) => {
  const [showActions, setShowActions] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const isGrouped = shouldGroupMessages(message, previousMessage)
  const shouldShowSender = !isGrouped
  const isHighlighted = highlightId === message.id

  // Memoize computed values
  const messageTime = useMemo(() => formatTime(message.createdAt), [message.createdAt])
  const hasReplyTo = !!message.replyTo && !!message.replyToPreview

  return (
    <div
      className={`transition-colors duration-300 ${
        isHighlighted ? "bg-primary/10" : ""
      } ${isGrouped ? "mt-0.5" : "mt-4"}`}
      data-message-id={message.id}
    >
      {/* Pinned message indicator */}
      {messagePinned && (
        <div className="px-4 py-1 text-xs text-muted-foreground flex items-center gap-1 mb-1">
          <Pin size={12} />
          Pinned message
        </div>
      )}

      <div className={`flex gap-3 px-4 ${isGrouped ? "py-0.5" : "py-3"}`}>
        {/* Avatar - only show if not grouped */}
        {shouldShowSender ? (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center text-xs font-bold">
            {senderPhoto ? (
              <img src={senderPhoto} alt={senderName} className="w-full h-full rounded-full" loading="lazy" />
            ) : (
              senderName.charAt(0).toUpperCase()
            )}
          </div>
        ) : (
          <div className="w-8 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {/* Sender name - only show if not grouped */}
          {shouldShowSender && (
            <div className="text-xs font-semibold text-foreground mb-1">
              {senderName}
              {isCurrentUser && <span className="text-muted-foreground ml-1">(You)</span>}
            </div>
          )}

          {/* Reply preview if replying to another message */}
          {hasReplyTo && (
            <div className="mb-2 pl-3 border-l-2 border-muted-foreground/30">
              <div className="text-xs text-muted-foreground">
                Replying to <span className="font-semibold">{message.replyToPreview?.senderName}</span>
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {message.replyToPreview?.text}
              </div>
            </div>
          )}

          {/* Message text with optimized rendering */}
          <div
            className={`text-sm text-foreground leading-relaxed break-words ${
              message.isEdited ? "opacity-90" : ""
            }`}
          >
            {message.text}
          </div>

          {/* Edit indicator */}
          {message.isEdited && (
            <div className="text-xs text-muted-foreground mt-1">
              (edited {formatTime(message.editedAt || message.createdAt)})
            </div>
          )}

          {/* Media attachments - lazy loaded */}
          {message.mediaAttachments?.map((attachment) => (
            <MediaAttachment key={attachment.id} attachment={attachment} />
          ))}

          {/* Reactions display */}
          {message.reactionCounts && Object.keys(message.reactionCounts).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(message.reactionCounts).map(([emoji, count]) => (
                <ReactionPill
                  key={emoji}
                  emoji={emoji}
                  count={count}
                  userReacted={message.reactions?.[emoji]?.includes("currentUserId") || false}
                  onClick={() => onReact?.(message.id, emoji)}
                />
              ))}
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="px-2 py-1 rounded-full hover:bg-muted transition-colors"
                title="Add reaction"
              >
                +
              </button>
            </div>
          )}

          {/* Quick reactions when hovering */}
          {showReactions && (
            <div className="flex flex-wrap gap-1 mt-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact?.(message.id, emoji)
                    setShowReactions(false)
                  }}
                  className="px-2 py-1 rounded-full hover:bg-muted transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Timestamp and actions */}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground group">
            <span>{messageTime}</span>
            {message.status && <span className="text-muted-foreground/60">{message.status}</span>}

            {/* Action buttons - show on hover */}
            <div
              className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseEnter={() => setShowActions(true)}
              onMouseLeave={() => setShowActions(false)}
            >
              <button
                onClick={() => onReply?.(message.id)}
                className="p-1 hover:bg-muted rounded transition-colors"
                title="Reply"
              >
                <Reply size={14} />
              </button>
              <button
                onClick={() => onReact?.(message.id, "❤️")}
                className="p-1 hover:bg-muted rounded transition-colors"
                title="Like"
              >
                <Heart size={14} />
              </button>
              <button
                className="p-1 hover:bg-muted rounded transition-colors"
                title="More options"
              >
                <MoreVertical size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export memoized version for performance
export const EnhancedGroupMessage = memo(EnhancedGroupMessageComponent)
