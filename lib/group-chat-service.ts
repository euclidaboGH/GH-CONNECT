/**
 * Group Chat Service
 * Bridges enhanced group chat features with the existing conversation engine
 * Maintains separation between group and private conversations
 */

import type { Conversation, Message } from "@/lib/ghc-types"
import type { GroupMessage } from "@/lib/group-chat-enhancements"
import {
  createGroupMessage,
  editMessage as editGroupMessage,
  pinMessage,
  markAsAnnouncement,
  bookmarkMessage,
  addReactionToMessage,
  removeReactionFromMessage,
  markMessageAsRead as markGroupMessageAsRead,
  forwardMessage as forwardGroupMessage,
  sortMessagesByTime,
  getPinnedMessages,
  getAnnouncements,
} from "@/lib/group-chat-enhancements"

/**
 * Convert regular Message to GroupMessage with enhanced features
 */
export function convertToGroupMessage(message: Message & Record<string, any>): GroupMessage {
  if (!message || !message.id) {
    throw new Error("Invalid message: missing required fields")
  }
  
  return {
    ...message,
    senderName: message.senderName || "Unknown",
    reactions: message.reactions || {},
    readBy: message.readBy || [],
    deliveryStatus: message.deliveryStatus || "sent",
  } as GroupMessage
}

/**
 * Group Chat State Manager
 */
export class GroupChatManager {
  private messages: Map<string, GroupMessage[]> = new Map()
  private typingUsers: Map<string, Set<string>> = new Map()
  private pinnedMessages: Map<string, GroupMessage[]> = new Map()
  private bookmarkedMessages: Map<string, GroupMessage[]> = new Map()

  /**
   * Initialize group chat with messages
   */
  initializeGroup(groupId: string, messages: GroupMessage[] = []): void {
    this.messages.set(groupId, sortMessagesByTime(messages))
    this.updatePinnedMessages(groupId)
    this.updateBookmarkedMessages(groupId)
  }

  /**
   * Add message to group
   */
  addMessage(groupId: string, message: GroupMessage): GroupMessage {
    const groupMessages = this.messages.get(groupId) || []
    const sorted = sortMessagesByTime([...groupMessages, message])
    this.messages.set(groupId, sorted)
    return message
  }

  /**
   * Edit message in group
   */
  editMessageInGroup(groupId: string, messageId: string, newText: string): GroupMessage | null {
    if (!groupId || !messageId || !newText?.trim()) {
      return null
    }
    
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const editedMessage = editGroupMessage(groupMessages[messageIndex], newText)
    groupMessages[messageIndex] = editedMessage
    this.messages.set(groupId, groupMessages)
    return editedMessage
  }

  /**
   * Delete message from group (for-everyone)
   */
  deleteMessageFromGroup(groupId: string, messageId: string): boolean {
    const groupMessages = this.messages.get(groupId) || []
    const filtered = groupMessages.filter(m => m.id !== messageId)
    
    if (filtered.length === groupMessages.length) return false
    
    this.messages.set(groupId, filtered)
    this.updatePinnedMessages(groupId)
    this.updateBookmarkedMessages(groupId)
    return true
  }

  /**
   * Add reaction to message
   */
  addReaction(
    groupId: string,
    messageId: string,
    emoji: string,
    userId: string,
    userName: string
  ): GroupMessage | null {
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const reacted = addReactionToMessage(
      groupMessages[messageIndex],
      emoji,
      userId,
      userName
    )
    groupMessages[messageIndex] = reacted
    return reacted
  }

  /**
   * Remove reaction from message
   */
  removeReaction(
    groupId: string,
    messageId: string,
    emoji: string,
    userId: string
  ): GroupMessage | null {
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const removed = removeReactionFromMessage(
      groupMessages[messageIndex],
      emoji,
      userId
    )
    groupMessages[messageIndex] = removed
    return removed
  }

  /**
   * Pin message in group
   */
  pinMessageInGroup(groupId: string, messageId: string): GroupMessage | null {
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const pinned = pinMessage(groupMessages[messageIndex], true)
    groupMessages[messageIndex] = pinned
    this.updatePinnedMessages(groupId)
    return pinned
  }

  /**
   * Unpin message in group
   */
  unpinMessageInGroup(groupId: string, messageId: string): GroupMessage | null {
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const unpinned = pinMessage(groupMessages[messageIndex], false)
    groupMessages[messageIndex] = unpinned
    this.updatePinnedMessages(groupId)
    return unpinned
  }

  /**
   * Mark message as announcement
   */
  markAsAnnouncement(groupId: string, messageId: string): GroupMessage | null {
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const announced = markAsAnnouncement(groupMessages[messageIndex], true)
    groupMessages[messageIndex] = announced
    this.updatePinnedMessages(groupId)
    return announced
  }

  /**
   * Bookmark message
   */
  bookmarkMessage(groupId: string, messageId: string): GroupMessage | null {
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const bookmarked = bookmarkMessage(groupMessages[messageIndex], true)
    groupMessages[messageIndex] = bookmarked
    this.updateBookmarkedMessages(groupId)
    return bookmarked
  }

  /**
   * Remove bookmark from message
   */
  removeBookmark(groupId: string, messageId: string): GroupMessage | null {
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const removed = bookmarkMessage(groupMessages[messageIndex], false)
    groupMessages[messageIndex] = removed
    this.updateBookmarkedMessages(groupId)
    return removed
  }

  /**
   * Mark message as read by user
   */
  markMessageAsRead(groupId: string, messageId: string, userId: string): GroupMessage | null {
    const groupMessages = this.messages.get(groupId) || []
    const messageIndex = groupMessages.findIndex(m => m.id === messageId)
    
    if (messageIndex === -1) return null

    const read = markGroupMessageAsRead(groupMessages[messageIndex], userId)
    groupMessages[messageIndex] = read
    return read
  }

  /**
   * Forward message to another group
   */
  forwardMessageToGroup(
    sourceGroupId: string,
    targetGroupId: string,
    messageId: string,
    sourceGroupName: string
  ): GroupMessage | null {
    const sourceMessages = this.messages.get(sourceGroupId) || []
    const sourceMessage = sourceMessages.find(m => m.id === messageId)
    
    if (!sourceMessage) return null

    const forwarded = forwardGroupMessage(sourceMessage, sourceGroupId, sourceGroupName)
    this.addMessage(targetGroupId, forwarded)
    return forwarded
  }

  /**
   * Add typing indicator
   */
  addTypingUser(groupId: string, userId: string, userName: string): void {
    if (!this.typingUsers.has(groupId)) {
      this.typingUsers.set(groupId, new Set())
    }
    this.typingUsers.get(groupId)!.add(userId)
  }

  /**
   * Remove typing indicator
   */
  removeTypingUser(groupId: string, userId: string): void {
    const typingSet = this.typingUsers.get(groupId)
    if (typingSet) {
      typingSet.delete(userId)
    }
  }

  /**
   * Get typing users in group
   */
  getTypingUsers(groupId: string): Set<string> {
    return this.typingUsers.get(groupId) || new Set()
  }

  /**
   * Get all messages in group
   */
  getGroupMessages(groupId: string): GroupMessage[] {
    return this.messages.get(groupId) || []
  }

  /**
   * Get pinned messages
   */
  getPinned(groupId: string): GroupMessage[] {
    return this.pinnedMessages.get(groupId) || []
  }

  /**
   * Get bookmarked messages
   */
  getBookmarked(groupId: string): GroupMessage[] {
    return this.bookmarkedMessages.get(groupId) || []
  }

  /**
   * Update pinned messages cache
   */
  private updatePinnedMessages(groupId: string): void {
    const messages = this.messages.get(groupId) || []
    const pinned = getPinnedMessages(messages).concat(getAnnouncements(messages))
    this.pinnedMessages.set(groupId, sortMessagesByTime(pinned))
  }

  /**
   * Update bookmarked messages cache
   */
  private updateBookmarkedMessages(groupId: string): void {
    const messages = this.messages.get(groupId) || []
    const bookmarked = messages.filter(m => m.isBookmarked)
    this.bookmarkedMessages.set(groupId, sortMessagesByTime(bookmarked))
  }

  /**
   * Clear group data
   */
  clearGroup(groupId: string): void {
    this.messages.delete(groupId)
    this.typingUsers.delete(groupId)
    this.pinnedMessages.delete(groupId)
    this.bookmarkedMessages.delete(groupId)
  }
}

/**
 * Singleton instance for group chat management
 */
export const groupChatManager = new GroupChatManager()
