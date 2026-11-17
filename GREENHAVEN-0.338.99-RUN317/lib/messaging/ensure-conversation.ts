import type { Conversation } from "@/lib/ghc-types"

/** Always produce a Conversation that satisfies required fields (Vercel-safe). */
export function ensureConversation(
  partial: Partial<Conversation> & Pick<Conversation, "id">
): Conversation {
  return {
    id: String(partial.id),
    participantId: String(partial.participantId || ""),
    participantName: String(partial.participantName || "Chat"),
    participantPhoto:
      String(partial.participantPhoto || "/placeholder.svg?width=40&height=40"),
    messages: Array.isArray(partial.messages) ? partial.messages : [],
    lastMessage: String(partial.lastMessage || ""),
    lastMessageTime: Number(partial.lastMessageTime) || Date.now(),
    unread: Boolean(partial.unread),
    online: Boolean(partial.online),
    conversationType: partial.conversationType === "group" ? "group" : "private",
    isPinned: partial.isPinned,
    isArchived: partial.isArchived,
    isTyping: partial.isTyping,
    typingUser: partial.typingUser,
    isMuted: partial.isMuted,
    muteUntil: partial.muteUntil,
    groupName: partial.groupName,
    groupPhoto: partial.groupPhoto,
    members: partial.members,
    memberIds: partial.memberIds,
    name: partial.name,
    updatedAt: partial.updatedAt,
    groupRoles: partial.groupRoles,
    createdBy: partial.createdBy,
    createdAt: partial.createdAt,
    privacy: partial.privacy,
    description: partial.description,
    category: partial.category,
    welcomeMessage: partial.welcomeMessage,
    rules: partial.rules,
    invitedMembers: partial.invitedMembers,
    boardPosts: partial.boardPosts,
    events: partial.events,
    lastReadMessageId: partial.lastReadMessageId,
    unreadCount: partial.unreadCount,
  }
}
