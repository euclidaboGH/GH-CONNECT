/**
 * Messaging domain contract — private DMs; distinct from community board/chat.
 */

import type { DomainResult, DomainEmptyState } from "./types"

export interface ConversationSummary {
  id: string
  peerUserId?: string
  title: string
  lastPreview: string
  unreadCount: number
  updatedAt: string
  kind: "direct" | "group" | "community"
}

export interface MessagingDomainContract {
  listInbox(limit?: number): DomainResult<ConversationSummary[]>
  conversationsNeedingAttention(): DomainResult<ConversationSummary[]>
  emptyInboxState(): DomainEmptyState
}

export function messagingEmptyState(): DomainEmptyState {
  return {
    title: "No conversations yet",
    description: "When you connect with people, your messages will appear here.",
    primaryAction: { label: "Discover people", tab: "discover" },
  }
}
