/**
 * Shared Conversation Engine
 * Centralizes all conversation, message, search, unread, and notification logic
 * used by both Chat (group) and Messages (private) screens
 */

import type { Conversation, Message } from "@/lib/ghc-types"

export type ConversationType = "private" | "group"

/**
 * Conversation filtering - by type
 */
export function filterConversationsByType(
  conversations: Conversation[],
  type: ConversationType
): Conversation[] {
  return conversations.filter(
    (c) => c.conversationType === type || (type === "group" && !c.conversationType)
  )
}

/**
 * Conversation search - searches both participant name and last message
 */
export function searchConversations(
  conversations: Conversation[],
  query: string
): Conversation[] {
  if (!query.trim()) return conversations

  const lowerQuery = query.toLowerCase()
  return conversations.filter(
    (c) =>
      c.participantName.toLowerCase().includes(lowerQuery) ||
      c.lastMessage.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get a single conversation by ID with type filtering
 */
export function getConversationById(
  conversations: Conversation[],
  id: string,
  type?: ConversationType
): Conversation | undefined {
  const conv = conversations.find((c) => c.id === id)
  if (!conv) return undefined
  if (type && conv.conversationType !== type) return undefined
  return conv
}

/**
 * Get unread count - counts conversations with unread flag
 */
export function getUnreadCount(conversations: Conversation[]): number {
  return conversations.filter((c) => c.unread).length
}

/**
 * Get unread count for specific type
 */
export function getUnreadCountByType(
  conversations: Conversation[],
  type: ConversationType
): number {
  return filterConversationsByType(conversations, type).filter((c) => c.unread).length
}

/**
 * Create a new private conversation object
 */
export function createPrivateConversation(
  id: string,
  participantId: string,
  participantName: string,
  participantPhoto: string,
  initialMessage: string
): Conversation {
  return {
    id,
    participantId,
    participantName,
    participantPhoto,
    messages: [
      {
        id,
        senderId: "current-user",
        text: initialMessage,
        createdAt: Date.now(),
      },
    ],
    lastMessage: initialMessage,
    lastMessageTime: Date.now(),
    unread: false,
    online: true,
    conversationType: "private",
  }
}

/**
 * Create a new group conversation object
 */
export function createGroupConversation(
  id: string,
  participantName: string,
  participantPhoto: string,
  initialMessage: string
): Conversation {
  return {
    id,
    participantId: "", // Not used for group conversations
    participantName,
    participantPhoto,
    messages: [
      {
        id,
        senderId: "current-user",
        text: initialMessage,
        createdAt: Date.now(),
      },
    ],
    lastMessage: initialMessage,
    lastMessageTime: Date.now(),
    unread: false,
    online: false, // Groups don't have online status
    conversationType: "group",
  }
}

/**
 * Add message to conversation
 */
export function addMessageToConversation(
  conversation: Conversation,
  messageId: string,
  text: string,
  senderId: string
): Conversation {
  const newMessage: Message = {
    id: messageId,
    senderId,
    text,
    createdAt: Date.now(),
  }

  return {
    ...conversation,
    messages: [...conversation.messages, newMessage],
    lastMessage: text,
    lastMessageTime: Date.now(),
  }
}

/**
 * Mark conversation as read and update unread flag
 */
export function markConversationAsRead(conversation: Conversation): Conversation {
  return {
    ...conversation,
    unread: false,
  }
}

/**
 * Check if a message belongs to the current user
 */
export function isMessageFromCurrentUser(message: Message): boolean {
  return message.senderId === "current-user"
}

/**
 * Get formatted last message time (e.g., "2 min ago", "Yesterday")
 */
export function getFormattedMessageTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  // Format as date for older messages
  const date = new Date(timestamp)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Get truncated preview of last message
 */
export function getMessagePreview(message: string, maxLength: number = 40): string {
  return message.length > maxLength ? message.substring(0, maxLength) + "..." : message
}

/**
 * Notification payload for new message
 */
export interface MessageNotification {
  conversationId: string
  conversationType: ConversationType
  participantName: string
  participantPhoto: string
  messageText: string
  senderName: string
}

/**
 * Create notification data for new message
 */
export function createMessageNotification(
  conversation: Conversation,
  lastMessage: string
): MessageNotification {
  return {
    conversationId: conversation.id,
    conversationType: conversation.conversationType || "group",
    participantName: conversation.participantName,
    participantPhoto: conversation.participantPhoto,
    messageText: lastMessage,
    senderName: conversation.participantName,
  }
}

/**
 * Sort conversations by last message time (newest first)
 */
export function sortConversationsByRecency(
  conversations: Conversation[]
): Conversation[] {
  return [...conversations].sort((a, b) => b.lastMessageTime - a.lastMessageTime)
}

/**
 * Get combined filtered and sorted conversations
 * Used to create the final list view in both Chat and Messages
 */
export function getFilteredSortedConversations(
  conversations: Conversation[],
  type: ConversationType,
  searchQuery: string = ""
): Conversation[] {
  const byType = filterConversationsByType(conversations, type)
  const filtered = searchConversations(byType, searchQuery)
  return sortConversationsByRecency(filtered)
}

/**
 * Conversation list state management helper
 * Returns all needed derived values for a conversation list UI
 */
export interface ConversationListState {
  conversations: Conversation[]
  filteredConversations: Conversation[]
  unreadCount: number
  isEmpty: boolean
  isSearching: boolean
  selectedConversation: Conversation | undefined
}

export function getConversationListState(
  conversations: Conversation[] | null | undefined,
  type: ConversationType,
  searchQuery: string = "",
  selectedConversationId: string | null = null
): ConversationListState {
  const safe = Array.isArray(conversations) ? conversations : []
  const filtered = getFilteredSortedConversations(safe, type, searchQuery)
  const selected = selectedConversationId
    ? getConversationById(filtered, selectedConversationId, type)
    : undefined

  return {
    conversations: filterConversationsByType(safe, type),
    filteredConversations: filtered,
    unreadCount: getUnreadCountByType(safe, type),
    isEmpty: filtered.length === 0,
    isSearching: !!searchQuery,
    selectedConversation: selected,
  }
}

/**
 * Filter conversations by pinned status
 */
export function filterPinnedConversations(conversations: Conversation[]): Conversation[] {
  return conversations.filter((c) => (c as any).isPinned === true)
}

/**
 * Filter conversations by archived status
 */
export function filterArchivedConversations(conversations: Conversation[]): Conversation[] {
  return conversations.filter((c) => (c as any).isArchived === true)
}

/**
 * Filter conversations by unread status
 */
export function filterUnreadConversations(conversations: Conversation[]): Conversation[] {
  return conversations.filter((c) => c.unread)
}

/**
 * Sort conversations: pinned first, then by recency
 */
export function sortWithPinnedFirst(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const aPinned = (a as any).isPinned === true ? 1 : 0
    const bPinned = (b as any).isPinned === true ? 1 : 0
    if (aPinned !== bPinned) return bPinned - aPinned
    return b.lastMessageTime - a.lastMessageTime
  })
}

/**
 * Get conversation by ID with optional type check
 */
export function getConversationByIdStrict(
  conversations: Conversation[],
  id: string
): Conversation | undefined {
  return conversations.find((c) => c.id === id)
}

/**
 * Batch update conversations
 */
export function batchUpdateConversations(
  conversations: Conversation[],
  ids: string[],
  updates: Partial<Conversation>
): Conversation[] {
  const idSet = new Set(ids)
  return conversations.map((c) => (idSet.has(c.id) ? { ...c, ...updates } : c))
}

/**
 * Mark multiple conversations as read
 */
export function markMultipleAsRead(conversations: Conversation[], ids: string[]): Conversation[] {
  return batchUpdateConversations(conversations, ids, { unread: false })
}

/**
 * Get online conversations
 */
export function filterOnlineConversations(conversations: Conversation[]): Conversation[] {
  return conversations.filter((c) => c.online)
}

/**
 * Get conversation stats
 */
export interface ConversationStats {
  totalConversations: number
  unreadConversations: number
  onlineConversations: number
  privateConversations: number
  groupConversations: number
  pinnedConversations: number
  archivedConversations: number
}

export function getConversationStats(conversations: Conversation[]): ConversationStats {
  return {
    totalConversations: conversations.length,
    unreadConversations: conversations.filter((c) => c.unread).length,
    onlineConversations: conversations.filter((c) => c.online).length,
    privateConversations: filterConversationsByType(conversations, "private").length,
    groupConversations: filterConversationsByType(conversations, "group").length,
    pinnedConversations: filterPinnedConversations(conversations).length,
    archivedConversations: filterArchivedConversations(conversations).length,
  }
}

/**
 * Message operations - unified for both private and group chats
 */

/**
 * Add or update message reaction
 */
export function addMessageReaction(
  message: Message,
  emoji: string,
  userId: string
): Message {
  const reactions = { ...message.reactions } || {}
  if (!reactions[emoji]) reactions[emoji] = []
  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId)
  }
  
  const reactionCounts = { ...message.reactionCounts } || {}
  reactionCounts[emoji] = reactions[emoji].length
  
  return { ...message, reactions, reactionCounts }
}

/**
 * Remove message reaction
 */
export function removeMessageReaction(
  message: Message,
  emoji: string,
  userId: string
): Message {
  const reactions = { ...message.reactions } || {}
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id) => id !== userId)
    if (reactions[emoji].length === 0) delete reactions[emoji]
  }
  
  const reactionCounts = { ...message.reactionCounts } || {}
  delete reactionCounts[emoji]
  
  return { ...message, reactions, reactionCounts }
}

/**
 * Mark message as read
 */
export function markMessageAsRead(
  message: Message,
  userId: string,
  isPrivateChat: boolean = true
): Message {
  if (isPrivateChat) {
    return {
      ...message,
      status: "read" as const,
      readAt: Date.now(),
    }
  }

  // Group chat - add to readBy list
  const readBy = [...(message.readBy || [])]
  if (!readBy.includes(userId)) {
    readBy.push(userId)
  }
  
  return {
    ...message,
    readBy,
  }
}

/**
 * Edit message
 */
export function editMessage(
  message: Message,
  newText: string,
  userId: string
): Message {
  const editHistory = [...(message.editHistory || [])]
  if (message.text) {
    editHistory.push({
      originalText: message.text,
      editedAt: Date.now(),
    })
  }
  
  return {
    ...message,
    text: newText,
    isEdited: true,
    editedAt: Date.now(),
    editedBy: userId,
    editHistory,
  }
}

/**
 * Delete message for everyone
 */
export function deleteMessageForEveryone(message: Message): Message {
  return {
    ...message,
    isDeletedForEveryone: true,
    text: "[Message deleted]",
  }
}

/**
 * Pin message in conversation
 */
export function pinMessage(message: Message): Message {
  return {
    ...message,
    isPinned: true,
  }
}

/**
 * Unpin message
 */
export function unpinMessage(message: Message): Message {
  return {
    ...message,
    isPinned: false,
  }
}

/**
 * Get pinned messages
 */
export function getPinnedMessages(messages: Message[]): Message[] {
  return messages.filter((m) => m.isPinned === true)
}

/**
 * Create a reply to a message
 */
export function createReplyMessage(
  replyToMessage: Message,
  replyText: string,
  senderId: string
): Message {
  return {
    id: generateMessageId(),
    senderId,
    text: replyText,
    createdAt: Date.now(),
    status: "sending",
    replyTo: replyToMessage.id,
    replyToPreview: {
      senderName: replyToMessage.senderId || "User",
      text: replyToMessage.text.substring(0, 50),
    },
  }
}

/**
 * Forward message
 */
export function forwardMessage(
  message: Message,
  userId: string
): Message {
  return {
    ...message,
    id: generateMessageId(),
    createdAt: Date.now(),
    status: "sending",
    isForwarded: true,
    forwardedFrom: message.id,
    forwardedBy: [userId],
  }
}

/**
 * Create voice note message
 */
export function createVoiceMessage(
  audioUrl: string,
  duration: number,
  waveform: number[],
  senderId: string
): Message {
  return {
    id: generateMessageId(),
    senderId,
    text: "🎤 Voice message",
    createdAt: Date.now(),
    status: "sending",
    mediaAttachments: [
      {
        id: generateMessageId(),
        type: "voice",
        url: audioUrl,
        duration,
        waveform,
      },
    ],
  }
}

/**
 * Create message with file/image
 */
export function createMediaMessage(
  mediaUrl: string,
  type: "image" | "file" | "video",
  senderId: string,
  fileName?: string,
  duration?: number,
  size?: number
): Message {
  return {
    id: generateMessageId(),
    senderId,
    text: type === "image" ? "📷 Sent a photo" : type === "video" ? "🎥 Sent a video" : `📎 Sent ${fileName}`,
    createdAt: Date.now(),
    status: "sending",
    mediaAttachments: [
      {
        id: generateMessageId(),
        type,
        url: mediaUrl,
        duration,
        size,
        fileName,
      },
    ],
  }
}

/**
 * Create scheduled message
 */
export function createScheduledMessage(
  text: string,
  senderId: string,
  scheduledFor: number
): Message {
  return {
    id: generateMessageId(),
    senderId,
    text,
    createdAt: Date.now(),
    scheduledFor,
    status: "sending",
  }
}

/**
 * Create disappearing message
 */
export function createDisappearingMessage(
  text: string,
  senderId: string,
  expiresInSeconds: number = 300
): Message {
  return {
    id: generateMessageId(),
    senderId,
    text,
    createdAt: Date.now(),
    status: "sending",
    expiresIn: expiresInSeconds,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  }
}

/**
 * Search messages in conversation
 */
export function searchMessages(
  messages: Message[],
  query: string
): Message[] {
  if (!query.trim()) return messages
  
  const lowerQuery = query.toLowerCase()
  return messages.filter(
    (m) =>
      m.text.toLowerCase().includes(lowerQuery) ||
      m.mentions?.some((mention) => mention.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Search for media in messages
 */
export function searchMediaInMessages(
  messages: Message[],
  mediaType?: "image" | "file" | "voice" | "video"
): Message[] {
  return messages.filter(
    (m) =>
      m.mediaAttachments &&
      m.mediaAttachments.length > 0 &&
      (!mediaType || m.mediaAttachments.some((attachment) => attachment.type === mediaType))
  )
}

/**
 * Conversation operations
 */

/**
 * Pin conversation
 */
export function pinConversation(conversation: Conversation): Conversation {
  return { ...conversation, isPinned: true }
}

/**
 * Unpin conversation
 */
export function unpinConversation(conversation: Conversation): Conversation {
  return { ...conversation, isPinned: false }
}

/**
 * Archive conversation
 */
export function archiveConversation(conversation: Conversation): Conversation {
  return { ...conversation, isArchived: true }
}

/**
 * Unarchive conversation
 */
export function unarchiveConversation(conversation: Conversation): Conversation {
  return { ...conversation, isArchived: false }
}

/**
 * Mute conversation notifications
 */
export function muteConversation(
  conversation: Conversation,
  muteUntilMs: number = 3600000 // 1 hour default
): Conversation {
  return {
    ...conversation,
    isMuted: true,
    muteUntil: Date.now() + muteUntilMs,
  }
}

/**
 * Unmute conversation
 */
export function unmuteConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    isMuted: false,
    muteUntil: undefined,
  }
}

/**
 * Set typing indicator
 */
export function setTypingIndicator(
  conversation: Conversation,
  typingUserId: string,
  isTyping: boolean
): Conversation {
  if (isTyping) {
    return {
      ...conversation,
      isTyping: true,
      typingUser: typingUserId,
    }
  }
  
  return {
    ...conversation,
    isTyping: false,
    typingUser: undefined,
  }
}

/**
 * Get read receipts for message
 */
export function getMessageReadReceipts(message: Message): string[] {
  return message.readBy || []
}

/**
 * Get message reactions
 */
export function getMessageReactions(message: Message): Record<string, number> {
  return message.reactionCounts || {}
}

/**
 * Check if message can be edited by user
 */
export function canEditMessage(message: Message, userId: string): boolean {
  // Can edit own messages within 5 minutes
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  return message.senderId === userId && message.createdAt > fiveMinutesAgo
}

/**
 * Check if message can be deleted by user
 */
export function canDeleteMessage(message: Message, userId: string): boolean {
  // Can delete own messages any time
  return message.senderId === userId
}

/**
 * Helper to generate unique message IDs
 */
export function generateMessageId(): string {
  return `msg_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`
}

/**
 * Batch update conversation (pin multiple, archive multiple, etc)
 */
export function batchUpdateConversation(
  conversation: Conversation,
  updates: Partial<Conversation>
): Conversation {
  return { ...conversation, ...updates }
}

/**
 * Get all drafts from messages (scheduled but not sent)
 */
export function getDraftMessages(conversations: Conversation[]): Message[] {
  const drafts: Message[] = []
  
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.status === "sending" && !msg.scheduledFor) {
        drafts.push(msg)
      }
    }
  }
  
  return drafts
}

/**
 * Get unread messages (status !== 'read')
 */
export function getUnreadMessages(messages: Message[]): Message[] {
  return messages.filter((m) => m.status !== "read")
}

/**
 * Get next message to display considering deletions and expirations
 */
export function getVisibleMessages(messages: Message[]): Message[] {
  return messages.filter(
    (m) =>
      !m.isDeletedForEveryone &&
      (!m.expiresAt || m.expiresAt > Date.now())
  )
}
