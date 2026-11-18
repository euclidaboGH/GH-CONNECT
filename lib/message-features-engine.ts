/**
 * Message Features Engine
 * Extends Message type with edit, delete, read receipts, reactions, etc.
 * Keeps existing Message structure intact while adding optional features
 */

import type { Message } from "@/lib/ghc-types"

/**
 * Extended Message with optional rich features
 * Backward compatible - all new fields are optional
 */
/**
 * Additive message features only — does not redeclare Message fields.
 * Use Message for shared shape; use these optionals for engine-only metadata.
 */
export interface EnhancedMessage extends Message {
  /** Engine-only delete lifecycle (Message uses isDeleted / isDeletedForEveryone) */
  deleteStatus?: "none" | "deleted-for-sender" | "deleted-for-everyone" | "pending-delete"
  deletedBy?: string

  /** Detailed read receipts; Message.readBy remains string[] of user ids */
  readReceipts?: Array<{ userId: string; readAt: number }>

  /** Engine-only forward timestamp (Message.forwardedBy is string[]) */
  forwardedAt?: number

  voiceNote?: VoiceNoteAttachment
  gifsUsed?: string[]
  /** Engine link preview shape (optional; distinct from generic metadata) */
  linkPreview?: LinkPreviewAttachment

  deliveryStatus?: "pending" | "sent" | "delivered" | "failed"
  deliveryError?: string
  pinnedAt?: number
  pinnedBy?: string

  /** Prefer Message.expiresAt / expiresIn when possible */
  disappearsAt?: number
  disappearsAfter?: number

  hashtags?: string[]
  keywords?: string[]
  language?: string

  isDraft?: boolean
  draftSavedAt?: number
}

export interface MessageAttachment {
  id: string
  type: "image" | "gif" | "file" | "video" | "audio"
  url: string
  fileName?: string
  fileSize?: number
  width?: number
  height?: number
  duration?: number // for video/audio
  thumbnail?: string
  mimeType?: string
}

export interface VoiceNoteAttachment {
  id: string
  url: string
  duration: number // seconds
  waveformData?: number[] // for visualization
  transcription?: string
  transcriptionLanguage?: string
}

export interface LinkPreviewAttachment {
  url: string
  title: string | null
  description: string | null
  image: string | null
  domain: string
  type?: "website" | "video" | "article" | "music"
}

/**
 * Convert regular Message to EnhancedMessage
 */
export function asEnhancedMessage(message: Message): EnhancedMessage {
  return message as EnhancedMessage
}

/**
 * Check if message is from current user
 */
export function isOwnMessage(message: Message, currentUserId: string): boolean {
  return message.senderId === currentUserId
}

/**
 * Check if message can be edited
 */
export function canEditMessage(message: EnhancedMessage, currentUserId: string): boolean {
  if (!isOwnMessage(message, currentUserId)) return false
  if (message.deleteStatus && message.deleteStatus !== "none") return false
  // Allow editing within 15 minutes
  const fifteenMinutesMs = 15 * 60 * 1000
  return Date.now() - message.createdAt < fifteenMinutesMs
}

/**
 * Check if message can be deleted
 */
export function canDeleteMessage(message: EnhancedMessage, currentUserId: string): boolean {
  if (!isOwnMessage(message, currentUserId)) return false
  if (message.deleteStatus && message.deleteStatus !== "none") return false
  return true
}

/**
 * Check if message can be reacted to
 */
export function canReactToMessage(message: EnhancedMessage): boolean {
  return message.deleteStatus !== "deleted-for-everyone" && !message.disappearsAt
}

/**
 * Add emoji reaction to message
 */
export function addReactionToMessage(
  message: EnhancedMessage,
  emoji: string,
  userId: string
): EnhancedMessage {
  if (!canReactToMessage(message)) return message

  const reactions = { ...message.reactions }
  if (!reactions[emoji]) reactions[emoji] = []

  if (!reactions[emoji].includes(userId)) {
    reactions[emoji] = [...reactions[emoji], userId]
  }

  return { ...message, reactions }
}

/**
 * Remove emoji reaction from message
 */
export function removeReactionFromMessage(
  message: EnhancedMessage,
  emoji: string,
  userId: string
): EnhancedMessage {
  if (!message.reactions || !message.reactions[emoji]) return message

  const reactions = { ...message.reactions }
  reactions[emoji] = reactions[emoji].filter((id) => id !== userId)

  if (reactions[emoji].length === 0) {
    delete reactions[emoji]
  }

  return { ...message, reactions }
}

/**
 * Get reactions summary for UI
 */
export function getReactionsSummary(message: EnhancedMessage): Array<{ emoji: string; count: number; hasUserReacted: boolean }> {
  if (!message.reactions) return []

  return Object.entries(message.reactions).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    hasUserReacted: userIds.includes("current-user"), // Replace with actual current user
  }))
}

/**
 * Mark message as read
 */
export function markMessageAsRead(
  message: EnhancedMessage,
  userId: string,
  readAt: number = Date.now()
): EnhancedMessage {
  const receipts = message.readReceipts || []
  if (receipts.some((r) => r.userId === userId)) {
    return message
  }
  const readerIds = new Set(message.readBy || [])
  readerIds.add(userId)
  return {
    ...message,
    readReceipts: [...receipts, { userId, readAt }],
    readBy: Array.from(readerIds),
  }
}

/**
 * Check if message has been read by user
 */
export function isMessageReadBy(message: EnhancedMessage, userId: string): boolean {
  if (message.readReceipts?.some((r) => r.userId === userId)) return true
  return message.readBy?.includes(userId) ?? false
}

/**
 * Get read receipt status
 */
export function getMessageReadStatus(message: EnhancedMessage): "pending" | "sent" | "delivered" | "read" {
  const hasReaders =
    (message.readReceipts && message.readReceipts.length > 0) ||
    (message.readBy && message.readBy.length > 0)
  if (!hasReaders) {
    return message.deliveryStatus === "delivered" ? "delivered" : "sent"
  }
  return "read"
}

/**
 * Edit message with timestamp
 */
export function editMessage(message: EnhancedMessage, newText: string, editedBy: string): EnhancedMessage {
  if (!canEditMessage(message, editedBy)) throw new Error("Cannot edit this message")

  return {
    ...message,
    text: newText,
    isEdited: true,
    editedAt: Date.now(),
    editedBy,
  }
}

/**
 * Delete message for sender only
 */
export function deleteMessageForSender(message: EnhancedMessage, deletedBy: string): EnhancedMessage {
  if (!canDeleteMessage(message, deletedBy)) throw new Error("Cannot delete this message")

  return {
    ...message,
    deleteStatus: "deleted-for-sender",
    deletedAt: Date.now(),
    deletedBy,
  }
}

/**
 * Delete message for everyone
 */
export function deleteMessageForEveryone(message: EnhancedMessage, deletedBy: string): EnhancedMessage {
  if (!canDeleteMessage(message, deletedBy)) throw new Error("Cannot delete this message")

  return {
    ...message,
    deleteStatus: "deleted-for-everyone",
    deletedAt: Date.now(),
    deletedBy,
    text: "[This message was deleted]",
  }
}

/**
 * Create voice note attachment
 */
export function createVoiceNoteAttachment(
  id: string,
  url: string,
  duration: number,
  waveformData?: number[]
): VoiceNoteAttachment {
  return {
    id,
    url,
    duration,
    waveformData,
  }
}

/**
 * Create message attachment
 */
export function createMessageAttachment(
  id: string,
  type: MessageAttachment["type"],
  url: string,
  metadata?: Omit<MessageAttachment, "id" | "type" | "url">
): MessageAttachment {
  return {
    id,
    type,
    url,
    ...metadata,
  }
}

/**
 * Set message to disappear after time
 */
export function setMessageToDisappear(message: EnhancedMessage, secondsUntilDelete: number): EnhancedMessage {
  return {
    ...message,
    disappearsAfter: secondsUntilDelete,
    disappearsAt: Date.now() + secondsUntilDelete * 1000,
  }
}

/**
 * Check if message should be displayed
 */
export function shouldDisplayMessage(message: EnhancedMessage, currentUserId: string): boolean {
  // Don't show if deleted for everyone
  if (message.deleteStatus === "deleted-for-everyone") return false

  // Don't show if deleted for sender and user is sender
  if (message.deleteStatus === "deleted-for-sender" && message.senderId === currentUserId) return false

  // Don't show if disappeared
  if (message.disappearsAt && Date.now() > message.disappearsAt) return false

  return true
}

/**
 * Get message display text
 */
export function getMessageDisplayText(message: EnhancedMessage): string {
  if (message.deleteStatus === "deleted-for-everyone") {
    return "[This message was deleted]"
  }

  if (message.deleteStatus === "deleted-for-sender") {
    return "[This message was removed]"
  }

  if (message.disappearsAt && Date.now() > message.disappearsAt) {
    return "[This message has disappeared]"
  }

  return message.text
}

/**
 * Get message timestamp for display
 */
export function getMessageTimestampForDisplay(message: EnhancedMessage): string {
  const timestamp = message.editedAt || message.createdAt
  const date = new Date(timestamp)
  const now = new Date()

  const isToday = date.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString()

  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  if (isToday) return timeStr
  if (isYesterday) return `Yesterday ${timeStr}`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Validate message content
 */
export function validateMessageContent(text: string): { valid: boolean; error?: string } {
  if (!text || !text.trim()) {
    return { valid: false, error: "Message cannot be empty" }
  }

  if (text.length > 5000) {
    return { valid: false, error: "Message is too long (max 5000 characters)" }
  }

  return { valid: true }
}

/**
 * Extract mentions from message text (@userId or @username)
 */
export function extractMentionsFromMessage(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g
  const matches = text.match(mentionRegex) || []
  return [...new Set(matches.map((m) => m.substring(1)))]
}

/**
 * Extract hashtags from message text (#hashtag)
 */
export function extractHashtagsFromMessage(text: string): string[] {
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g
  const matches = text.match(hashtagRegex) || []
  return [...new Set(matches.map((m) => m.substring(1)))]
}

/**
 * Extract URLs from message text
 */
export function extractUrlsFromMessage(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const matches = text.match(urlRegex) || []
  return [...new Set(matches)]
}
