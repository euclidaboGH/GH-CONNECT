export type RelationshipOutcomeInput = {
  unreadCount: number
  requestCount: number
  conversationCount: number
  communityConversationCount: number
  connectionCount: number
  matchCount: number
}

export type RelationshipOutcome = {
  title: string
  detail: string
  badge: string
  tone: "attention" | "progress" | "ready"
  action: "requests" | "unread" | "communities" | "discover"
  actionLabel: string
}

/**
 * Turns existing relationship state into one useful next move.
 * This is deliberately deterministic: no fabricated scores, inferred affinity,
 * or hidden ranking is introduced here.
 */
export function buildRelationshipOutcome(input: RelationshipOutcomeInput): RelationshipOutcome {
  if (input.requestCount > 0) {
    return {
      title: `${input.requestCount} message request${input.requestCount === 1 ? "" : "s"} waiting`,
      detail: "Review requests first. People outside your accepted network stay separated until you decide to continue the conversation.",
      badge: "Review",
      tone: "attention",
      action: "requests",
      actionLabel: "Review requests",
    }
  }
  if (input.unreadCount > 0) {
    return {
      title: `${input.unreadCount} conversation${input.unreadCount === 1 ? "" : "s"} need attention`,
      detail: "Continue the conversations already in motion before starting more. Your unread inbox is the fastest path back into active relationships.",
      badge: "Continue",
      tone: "attention",
      action: "unread",
      actionLabel: "Open unread",
    }
  }
  if (input.communityConversationCount > 0) {
    return {
      title: "Your conversations are caught up",
      detail: `You have ${input.communityConversationCount} community conversation${input.communityConversationCount === 1 ? "" : "s"} available when you want to rejoin the discussion.`,
      badge: "Caught up",
      tone: "ready",
      action: "communities",
      actionLabel: "Community chats",
    }
  }
  if (input.connectionCount > 0 || input.matchCount > 0 || input.conversationCount > 0) {
    return {
      title: "Your network is ready for the next conversation",
      detail: "You are caught up here. Discover people with relevant profiles and start a conversation only when there is a useful reason to connect.",
      badge: "Ready",
      tone: "progress",
      action: "discover",
      actionLabel: "Discover people",
    }
  }
  return {
    title: "Start with a meaningful connection",
    detail: "Discover people, review their profiles and connect around shared interests, communities or opportunities before messaging.",
    badge: "Start",
    tone: "progress",
    action: "discover",
    actionLabel: "Find people",
  }
}
