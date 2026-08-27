/**
 * Unified Messaging & Chat Features Engine
 * Centralized business logic for all messaging features - NO DUPLICATES
 * Used by both Messages (private) and Chat (group) screens
 * 
 * Architecture:
 * - Message operations (reactions, edits, deletions, forwarding, replies)
 * - Conversation operations (pinning, archiving, muting, search)
 * - Media handling (images, files, voice notes with waveforms)
 * - Typing indicators & online status
 * - Read receipts & message status tracking
 * - Draft & scheduled message management
 * - Disappearing messages
 * - Group-specific features (roles, member management)
 */

import type { Conversation, Message } from "./ghc-types"

// Compatibility exports keep conversation list helpers on the canonical messaging path.
// The implementations remain centralized in conversation-engine while consumers migrate.
export {
  filterConversationsByType,
  searchConversations,
  getConversationById,
  getUnreadCount,
  getUnreadCountByType,
  getConversationListState,
  isMessageFromCurrentUser,
} from "./conversation-engine"

/**
 * Validation helpers
 */

export function isValidMessage(text: string): boolean {
  return text.trim().length > 0 && text.trim().length <= 5000
}

export function isValidVoiceNote(duration: number): boolean {
  return duration > 0 && duration <= 300 // max 5 minutes
}

export function isValidFileSize(sizeInBytes: number): boolean {
  return sizeInBytes > 0 && sizeInBytes <= 100 * 1024 * 1024 // max 100MB
}

/**
 * Conversation list operations
 */

export interface ConversationListFilter {
  type?: "private" | "group"
  unreadOnly?: boolean
  pinnedOnly?: boolean
  archivedOnly?: boolean
  searchQuery?: string
}

export function filterConversationList(
  conversations: Conversation[],
  filter: ConversationListFilter
): Conversation[] {
  let filtered = [...conversations]

  if (filter.type) {
    filtered = filtered.filter((c) => c.conversationType === filter.type)
  }

  if (filter.unreadOnly) {
    filtered = filtered.filter((c) => c.unread && !c.isArchived)
  }

  if (filter.pinnedOnly) {
    filtered = filtered.filter((c) => c.isPinned && !c.isArchived)
  }

  if (filter.archivedOnly) {
    filtered = filtered.filter((c) => c.isArchived)
  }

  if (filter.searchQuery?.trim()) {
    const query = filter.searchQuery.toLowerCase()
    filtered = filtered.filter(
      (c) =>
        c.participantName.toLowerCase().includes(query) ||
        c.lastMessage.toLowerCase().includes(query) ||
        c.messages.some((m) => m.text.toLowerCase().includes(query))
    )
  }

  // Sort: pinned first, then by recency
  return filtered.sort((a, b) => {
    const aPinned = a.isPinned ? 1 : 0
    const bPinned = b.isPinned ? 1 : 0
    if (aPinned !== bPinned) return bPinned - aPinned
    return b.lastMessageTime - a.lastMessageTime
  })
}

/**
 * Message operations with business logic
 */

export interface MessageOperation {
  type: "send" | "edit" | "delete" | "react" | "pin" | "reply" | "forward" | "schedule"
  messageId: string
  userId: string
  conversationId: string
  timestamp: number
  metadata?: Record<string, any>
}

/**
 * Validate and prepare message before sending
 */
export function prepareMessageForSending(
  text: string,
  userId: string,
  conversationId: string
): Message | null {
  if (!isValidMessage(text)) return null

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    senderId: userId,
    text: text.trim(),
    createdAt: Date.now(),
    status: "sending",
    canEdit: true,
    canDelete: true,
  }
}

/**
 * Handle message edits with validation
 */
export function handleMessageEdit(
  message: Message,
  newText: string,
  userId: string
): Message | null {
  // Can only edit own messages within 5 minutes
  if (message.senderId !== userId) return null

  const editWindowMs = 5 * 60 * 1000
  if (Date.now() - message.createdAt > editWindowMs) return null

  if (!isValidMessage(newText)) return null

  const editHistory = message.editHistory || []
  editHistory.push({
    originalText: message.text,
    editedAt: Date.now(),
  })

  return {
    ...message,
    text: newText.trim(),
    isEdited: true,
    editedAt: Date.now(),
    editHistory,
  }
}

/**
 * Handle message deletion
 */
export function handleMessageDeletion(
  message: Message,
  userId: string,
  deleteForEveryone: boolean = false
): Message | null {
  // Delete for everyone: only the sender, soft-delete the message body
  if (deleteForEveryone) {
    if (message.senderId !== userId) return null
    return {
      ...message,
      isDeletedForEveryone: true,
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: userId,
      text: "This message was deleted",
      mediaAttachments: undefined,
    }
  }

  // Delete for me: hide from this user's view only (local visibility)
  // Server would store MessageVisibility { userId, messageId, hiddenAt }
  return {
    ...message,
    isDeleted: true,
    deletedAt: Date.now(),
    deletedBy: userId,
    // Keep original text server-side; client hides via isDeleted for this viewer
    text: message.senderId === userId ? message.text : message.text,
    hiddenFor: Array.from(new Set([...(message as any).hiddenFor || [], userId])),
  }
}

/**
 * Handle message reactions
 */
export function handleMessageReaction(
  message: Message,
  emoji: string,
  userId: string,
  isAdding: boolean = true
): Message {
  const reactions = { ...message.reactions } || {}
  const reactionCounts = { ...message.reactionCounts } || {}

  if (isAdding) {
    if (!reactions[emoji]) reactions[emoji] = []
    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId)
      reactionCounts[emoji] = reactions[emoji].length
    }
  } else {
    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter((id) => id !== userId)
      if (reactions[emoji].length === 0) {
        delete reactions[emoji]
        delete reactionCounts[emoji]
      } else {
        reactionCounts[emoji] = reactions[emoji].length
      }
    }
  }

  return { ...message, reactions, reactionCounts }
}

/**
 * Handle reply creation
 */
export function handleMessageReply(
  originalMessage: Message,
  replyText: string,
  userId: string
): Message | null {
  if (!isValidMessage(replyText)) return null

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    senderId: userId,
    text: replyText.trim(),
    createdAt: Date.now(),
    status: "sending",
    replyTo: originalMessage.id,
    replyToPreview: {
      senderName: originalMessage.senderId || "User",
      text: originalMessage.text.substring(0, 100),
    },
  }
}

/**
 * Handle message forwarding
 */
export function handleMessageForwarding(
  message: Message,
  userId: string
): Message | null {
  if (!message.text) return null

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    senderId: userId,
    text: message.text,
    createdAt: Date.now(),
    status: "sending",
    isForwarded: true,
    forwardedFrom: message.id,
    mediaAttachments: message.mediaAttachments,
  }
}

/**
 * Handle read receipts
 */
export function handleMessageRead(
  message: Message,
  userId: string,
  isGroupChat: boolean = false
): Message {
  if (isGroupChat) {
    const readBy = [...(message.readBy || [])]
    if (!readBy.includes(userId)) {
      readBy.push(userId)
    }
    return { ...message, readBy }
  }

  // Private chat
  if (message.status !== "read") {
    return {
      ...message,
      status: "read",
      readAt: Date.now(),
    }
  }

  return message
}

/**
 * Handle typing indicators with auto-clear
 */
export class TypingIndicatorManager {
  private typingTimers: Map<string, NodeJS.Timeout> = new Map()

  setTyping(conversationId: string, userId: string, onClear: () => void) {
    // Clear existing timer for this conversation
    const existingTimer = this.typingTimers.get(conversationId)
    if (existingTimer) clearTimeout(existingTimer)

    // Set new timer (clear after 3 seconds of inactivity)
    const timer = setTimeout(() => {
      onClear()
      this.typingTimers.delete(conversationId)
    }, 3000)

    this.typingTimers.set(conversationId, timer)
  }

  clearTyping(conversationId: string) {
    const timer = this.typingTimers.get(conversationId)
    if (timer) clearTimeout(timer)
    this.typingTimers.delete(conversationId)
  }

  clearAll() {
    this.typingTimers.forEach((timer) => clearTimeout(timer))
    this.typingTimers.clear()
  }
}

/**
 * Message search with rich options
 */
export interface MessageSearchOptions {
  query?: string
  fromUser?: string
  hasAttachments?: boolean
  mediaType?: "image" | "file" | "voice" | "video"
  dateFrom?: number
  dateTo?: number
  isPinned?: boolean
}

export function searchMessages(
  messages: Message[],
  options: MessageSearchOptions
): Message[] {
  let results = [...messages]

  if (options.query?.trim()) {
    const q = options.query.toLowerCase()
    results = results.filter(
      (m) =>
        m.text.toLowerCase().includes(q) ||
        m.mentions?.some((mention) => mention.toLowerCase().includes(q))
    )
  }

  if (options.fromUser) {
    results = results.filter((m) => m.senderId === options.fromUser)
  }

  if (options.hasAttachments !== undefined) {
    results = results.filter(
      (m) =>
        (options.hasAttachments && m.mediaAttachments && m.mediaAttachments.length > 0) ||
        (!options.hasAttachments && (!m.mediaAttachments || m.mediaAttachments.length === 0))
    )
  }

  if (options.mediaType) {
    results = results.filter(
      (m) =>
        m.mediaAttachments &&
        m.mediaAttachments.some((att) => att.type === options.mediaType)
    )
  }

  if (options.dateFrom) {
    results = results.filter((m) => m.createdAt >= options.dateFrom!)
  }

  if (options.dateTo) {
    results = results.filter((m) => m.createdAt <= options.dateTo!)
  }

  if (options.isPinned !== undefined) {
    results = results.filter((m) => (m.isPinned === true) === options.isPinned)
  }

  return results
}

/**
 * Conversation state managers
 */

export function toggleConversationPin(
  conversation: Conversation
): Conversation {
  return {
    ...conversation,
    isPinned: !conversation.isPinned,
  }
}

export function toggleConversationArchive(
  conversation: Conversation
): Conversation {
  return {
    ...conversation,
    isArchived: !conversation.isArchived,
  }
}

export function toggleConversationMute(
  conversation: Conversation,
  muteHours: number = 1
): Conversation {
  if (conversation.isMuted) {
    return {
      ...conversation,
      isMuted: false,
      muteUntil: undefined,
    }
  }

  return {
    ...conversation,
    isMuted: true,
    muteUntil: Date.now() + muteHours * 60 * 60 * 1000,
  }
}

/**
 * Media handling
 */

export interface MediaUploadProgress {
  fileName: string
  progress: number // 0-100
  status: "pending" | "uploading" | "done" | "error"
}

export function createVoiceNoteMessage(
  audioBlob: Blob,
  waveformData: number[],
  userId: string,
  onProgress?: (progress: number) => void
): Promise<Message> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      onProgress?.(100)

      resolve({
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        senderId: userId,
        text: "🎤 Voice message",
        createdAt: Date.now(),
        status: "sending",
        mediaAttachments: [
          {
            id: `media_${Date.now()}`,
            type: "voice",
            url: e.target?.result as string,
            duration: Math.round(audioBlob.size / 16000), // rough estimate
            waveform: waveformData,
            size: audioBlob.size,
          },
        ],
      })
    }
    reader.readAsDataURL(audioBlob)
  })
}

/**
 * Scheduled message management
 */

export class ScheduledMessageQueue {
  private queue: Map<string, NodeJS.Timeout> = new Map()

  schedule(
    message: Message,
    delayMs: number,
    onReady: (message: Message) => void
  ) {
    const id = message.id
    const timer = setTimeout(() => {
      onReady(message)
      this.queue.delete(id)
    }, delayMs)

    this.queue.set(id, timer)
  }

  cancel(messageId: string) {
    const timer = this.queue.get(messageId)
    if (timer) {
      clearTimeout(timer)
      this.queue.delete(messageId)
    }
  }

  clear() {
    this.queue.forEach((timer) => clearTimeout(timer))
    this.queue.clear()
  }
}

/**
 * Group chat features
 */

export type GroupRole = "admin" | "member"

export function updateGroupRole(
  conversation: Conversation,
  userId: string,
  role: GroupRole
): Conversation {
  const groupRoles = { ...conversation.groupRoles } || {}
  groupRoles[userId] = role

  return {
    ...conversation,
    groupRoles,
  }
}

export function removeGroupMember(
  conversation: Conversation,
  userId: string
): Conversation {
  const members = conversation.members?.filter((id) => id !== userId) || []
  const groupRoles = { ...conversation.groupRoles }
  delete groupRoles[userId]

  return {
    ...conversation,
    members,
    groupRoles,
  }
}

/**
 * Draft message persistence
 */

export interface DraftMessage {
  conversationId: string
  text: string
  mediaAttachments?: any[]
  mentions?: string[]
  createdAt: number
}

export const draftStorage = {
  save(conversationId: string, text: string, mediaAttachments?: any[]) {
    const draft: DraftMessage = {
      conversationId,
      text,
      mediaAttachments,
      createdAt: Date.now(),
    }
    sessionStorage.setItem(
      `draft_${conversationId}`,
      JSON.stringify(draft)
    )
  },

  load(conversationId: string): DraftMessage | null {
    const stored = sessionStorage.getItem(`draft_${conversationId}`)
    return stored ? JSON.parse(stored) : null
  },

  clear(conversationId: string) {
    sessionStorage.removeItem(`draft_${conversationId}`)
  },

  clearAll() {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("draft_"))
      .forEach((key) => sessionStorage.removeItem(key))
  },
}

/**
 * Message analytics
 */

export interface MessageAnalytics {
  totalMessages: number
  messagesWithReactions: number
  messagesWithReplies: number
  messagesWithAttachments: number
  averageMessageLength: number
  averageMessagesPerHour: number
  mostActiveHour: number | null
}

export function analyzeMessageThreadData(
  messages: Message[],
  timeWindowMs: number = 24 * 60 * 60 * 1000
): MessageAnalytics {
  const now = Date.now()
  const recentMessages = messages.filter((m) => now - m.createdAt <= timeWindowMs)

  const totalLength = recentMessages.reduce((sum, m) => sum + m.text.length, 0)
  const avgLength = recentMessages.length > 0 ? totalLength / recentMessages.length : 0

  const hoursInWindow = Math.max(1, timeWindowMs / (60 * 60 * 1000))
  const avgPerHour = recentMessages.length / hoursInWindow

  // Find most active hour
  const hourCounts = new Map<number, number>()
  recentMessages.forEach((m) => {
    const hour = new Date(m.createdAt).getHours()
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
  })

  const mostActiveHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    totalMessages: recentMessages.length,
    messagesWithReactions: recentMessages.filter((m) => m.reactions && Object.keys(m.reactions).length > 0).length,
    messagesWithReplies: recentMessages.filter((m) => m.replyTo).length,
    messagesWithAttachments: recentMessages.filter((m) => m.mediaAttachments && m.mediaAttachments.length > 0).length,
    averageMessageLength: avgLength,
    averageMessagesPerHour: avgPerHour,
    mostActiveHour,
  }
}
