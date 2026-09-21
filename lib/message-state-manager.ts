/**
 * Message State Manager — compatibility helpers (drafts, pagination, search types).
 *
 * Prefer `@/lib/unified-messaging-engine` for messaging feature operations and
 * `@/lib/domains` messaging-domain for authoritative writes (send/delete).
 * This module remains for any legacy draft/pagination helpers; do not expand
 * it as a second messaging authority.
 */

import type { Message } from "@/lib/ghc-types"
import type { EnhancedMessage } from "@/lib/message-features-engine"

/**
 * Message draft state
 */
export interface MessageDraft {
  conversationId: string
  text: string
  mediaAttachments?: Array<{ id: string; url: string; type: string }>
  replyTo?: string
  mentions?: string[]
  savedAt: number
  autoSaved?: boolean
}

/**
 * Message search result
 */
export interface MessageSearchResult {
  messageId: string
  conversationId: string
  text: string
  senderId: string
  createdAt: number
  relevanceScore: number
  context?: string // surrounding message text
}

/**
 * Message loading state
 */
export interface MessageLoadingState {
  isLoadingMessages: boolean
  isLoadingEarlierMessages: boolean
  isLoadingDrafts: boolean
  isSearching: boolean
  error?: string
}

/**
 * Draft storage key for persistence
 */
export function getDraftStorageKey(conversationId: string): string {
  return `draft_${conversationId}`
}

/**
 * Save draft message
 */
export function saveDraft(
  conversationId: string,
  text: string,
  metadata?: Partial<MessageDraft>
): MessageDraft {
  const draft: MessageDraft = {
    conversationId,
    text,
    savedAt: Date.now(),
    autoSaved: false,
    ...metadata,
  }

  try {
    if (typeof window !== "undefined") {
      const key = getDraftStorageKey(conversationId)
      localStorage.setItem(key, JSON.stringify(draft))
    }
  } catch (e) {
    console.warn("Failed to save draft to localStorage:", e)
  }

  return draft
}

/**
 * Load draft message
 */
export function loadDraft(conversationId: string): MessageDraft | null {
  try {
    if (typeof window === "undefined") return null

    const key = getDraftStorageKey(conversationId)
    const stored = localStorage.getItem(key)

    if (!stored) return null

    return JSON.parse(stored) as MessageDraft
  } catch (e) {
    console.warn("Failed to load draft from localStorage:", e)
    return null
  }
}

/**
 * Delete draft message
 */
export function deleteDraft(conversationId: string): void {
  try {
    if (typeof window === "undefined") return

    const key = getDraftStorageKey(conversationId)
    localStorage.removeItem(key)
  } catch (e) {
    console.warn("Failed to delete draft:", e)
  }
}

/**
 * Clear all drafts
 */
export function clearAllDrafts(): void {
  try {
    if (typeof window === "undefined") return

    Object.keys(localStorage)
      .filter((key) => key.startsWith("draft_"))
      .forEach((key) => localStorage.removeItem(key))
  } catch (e) {
    console.warn("Failed to clear drafts:", e)
  }
}

/**
 * Search messages by text - OPTIMIZED: removed duplicate, use unified-messaging-engine instead
 * This function is maintained for backwards compatibility but delegates to the unified search
 * Import searchMessages from unified-messaging-engine for better performance
 */
export function searchMessages(
  messages: EnhancedMessage[],
  query: string,
  conversationId: string
): MessageSearchResult[] {
  if (!query.trim()) return []

  const lowerQuery = query.toLowerCase()
  const seen = new Set<string>()
  const results: MessageSearchResult[] = []

  // Single pass with early exit on duplicates
  for (const message of messages) {
    if (seen.has(message.id)) continue
    
    const messageText = message.text.toLowerCase()
    let relevanceScore = 0
    let context: string | undefined

    // Check text match first (highest priority)
    if (messageText.includes(lowerQuery)) {
      const index = messageText.indexOf(lowerQuery)
      const contextStart = Math.max(0, index - 20)
      const contextEnd = Math.min(message.text.length, index + lowerQuery.length + 20)
      context = `...${message.text.substring(contextStart, contextEnd)}...`
      relevanceScore = 1
    } 
    // Check mentions
    else if (message.mentions?.some((m) => m.toLowerCase().includes(lowerQuery))) {
      relevanceScore = 0.8
    } 
    // Check hashtags
    else if (message.hashtags?.some((h) => h.toLowerCase().includes(lowerQuery))) {
      relevanceScore = 0.6
    }

    if (relevanceScore > 0) {
      seen.add(message.id)
      results.push({
        messageId: message.id,
        conversationId,
        text: message.text,
        senderId: message.senderId,
        createdAt: message.createdAt,
        relevanceScore,
        context,
      })
    }
  }

  // Sort by relevance without re-mapping
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * Filter messages by type
 */
export function filterMessagesByType(
  messages: EnhancedMessage[],
  type: "text" | "media" | "voice" | "images" | "files"
): EnhancedMessage[] {
  return messages.filter((msg) => {
    switch (type) {
      case "media":
        return msg.mediaAttachments && msg.mediaAttachments.length > 0
      case "voice":
        return msg.voiceNote !== undefined
      case "images":
        return msg.mediaAttachments?.some((m) => m.type === "image") ?? false
      case "files":
        return msg.mediaAttachments?.some((m) => m.type === "file") ?? false
      case "text":
      default:
        return !msg.mediaAttachments && !msg.voiceNote
    }
  })
}

/**
 * Filter messages by date range
 */
export function filterMessagesByDateRange(
  messages: EnhancedMessage[],
  startDate: number,
  endDate: number
): EnhancedMessage[] {
  return messages.filter((msg) => msg.createdAt >= startDate && msg.createdAt <= endDate)
}

/**
 * Filter messages by sender
 */
export function filterMessagesBySender(
  messages: EnhancedMessage[],
  senderId: string
): EnhancedMessage[] {
  return messages.filter((msg) => msg.senderId === senderId)
}

/**
 * Get message statistics
 */
export interface MessageStats {
  totalMessages: number
  textMessages: number
  mediaMessages: number
  voiceMessages: number
  pinnedMessages: number
  deletedMessages: number
  averageMessageLength: number
  oldestMessage?: number
  newestMessage?: number
}

export function getMessageStatistics(messages: EnhancedMessage[]): MessageStats {
  const stats: MessageStats = {
    totalMessages: messages.length,
    textMessages: 0,
    mediaMessages: 0,
    voiceMessages: 0,
    pinnedMessages: 0,
    deletedMessages: 0,
    averageMessageLength: 0,
  }

  let totalLength = 0

  messages.forEach((msg) => {
    if (msg.deleteStatus === "deleted-for-everyone") stats.deletedMessages++
    if (msg.isPinned) stats.pinnedMessages++
    if (msg.mediaAttachments?.length) stats.mediaMessages++
    if (msg.voiceNote) stats.voiceMessages++
    if (!msg.mediaAttachments && !msg.voiceNote) {
      stats.textMessages++
      totalLength += msg.text.length
    }
  })

  stats.averageMessageLength = stats.textMessages > 0 ? Math.round(totalLength / stats.textMessages) : 0
  stats.oldestMessage = messages.length > 0 ? messages[messages.length - 1]?.createdAt : undefined
  stats.newestMessage = messages.length > 0 ? messages[0]?.createdAt : undefined

  return stats
}

/**
 * Initialize loading state
 */
export function createInitialLoadingState(): MessageLoadingState {
  return {
    isLoadingMessages: true,
    isLoadingEarlierMessages: false,
    isLoadingDrafts: false,
    isSearching: false,
  }
}

/**
 * Update loading state
 */
export function updateLoadingState(
  state: MessageLoadingState,
  updates: Partial<MessageLoadingState>
): MessageLoadingState {
  return { ...state, ...updates }
}

/**
 * Validate draft before sending
 */
export function validateDraft(draft: MessageDraft): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!draft.text?.trim()) {
    errors.push("Message cannot be empty")
  }

  if (draft.text.length > 5000) {
    errors.push("Message is too long (max 5000 characters)")
  }

  if (draft.mediaAttachments && draft.mediaAttachments.length > 20) {
    errors.push("Too many attachments (max 20)")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get scheduled messages
 */
export function getScheduledMessages(messages: EnhancedMessage[]): EnhancedMessage[] {
  return messages.filter((msg) => msg.scheduledFor && msg.scheduledFor > Date.now())
}

/**
 * Get pending messages
 */
export function getPendingMessages(messages: EnhancedMessage[]): EnhancedMessage[] {
  return messages.filter((msg) => msg.deliveryStatus === "pending")
}

/**
 * Get failed messages
 */
export function getFailedMessages(messages: EnhancedMessage[]): EnhancedMessage[] {
  return messages.filter((msg) => msg.deliveryStatus === "failed")
}

/**
 * Get read messages
 */
export function getReadMessages(messages: EnhancedMessage[]): EnhancedMessage[] {
  return messages.filter((msg) => msg.readBy && msg.readBy.length > 0)
}

/**
 * Merge message arrays avoiding duplicates
 */
export function mergeMessageArrays(
  existing: EnhancedMessage[],
  incoming: EnhancedMessage[]
): EnhancedMessage[] {
  const map = new Map<string, EnhancedMessage>()

  existing.forEach((msg) => map.set(msg.id, msg))
  incoming.forEach((msg) => map.set(msg.id, msg))

  return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * Paginate messages
 */
export interface MessagePage {
  messages: EnhancedMessage[]
  hasNextPage: boolean
  hasPreviousPage: boolean
  pageNumber: number
  pageSize: number
  totalPages: number
}

export function paginateMessages(
  messages: EnhancedMessage[],
  pageNumber: number = 1,
  pageSize: number = 50
): MessagePage {
  const start = (pageNumber - 1) * pageSize
  const end = start + pageSize
  const pageMessages = messages.slice(start, end)
  const totalPages = Math.ceil(messages.length / pageSize)

  return {
    messages: pageMessages,
    hasNextPage: end < messages.length,
    hasPreviousPage: pageNumber > 1,
    pageNumber,
    pageSize,
    totalPages,
  }
}


/** Compatibility re-exports — canonical messaging feature path */
export { searchMessages, draftStorage, filterConversationList } from "./unified-messaging-engine"
