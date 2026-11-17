/**
 * Community participation outcome model.
 * Uses only authoritative/visible community state; never invents participation or reward outcomes.
 */
export type CommunityOutcomeKind = "attention" | "poll" | "event" | "challenge" | "chat" | "explore"

export interface CommunityOutcome {
  kind: CommunityOutcomeKind
  title: string
  detail: string
  actionLabel: string
  priority: "high" | "medium" | "low"
}

export function buildCommunityOutcome(input: {
  isJoined: boolean
  boardUnread?: number
  chatUnread?: number
  activePolls?: any[]
  upcomingEvents?: any[]
  boardPosts?: any[]
  chatAvailable?: boolean
}): CommunityOutcome {
  const boardUnread = Math.max(0, Number(input.boardUnread || 0))
  const chatUnread = Math.max(0, Number(input.chatUnread || 0))
  const polls = Array.isArray(input.activePolls) ? input.activePolls : []
  const events = Array.isArray(input.upcomingEvents) ? input.upcomingEvents : []
  const posts = Array.isArray(input.boardPosts) ? input.boardPosts : []

  if (!input.isJoined) {
    return { kind: "explore", title: "See what this community is about", detail: "Review the board, rules and participation spaces before joining.", actionLabel: "Review community", priority: "medium" }
  }
  if (boardUnread > 0) {
    return { kind: "attention", title: "Your community has new activity", detail: `${boardUnread} board item${boardUnread === 1 ? "" : "s"} need${boardUnread === 1 ? "s" : ""} your attention.`, actionLabel: "Review board", priority: "high" }
  }
  if (polls.length > 0) {
    return { kind: "poll", title: "Your voice can help shape the community", detail: `${polls.length} active poll${polls.length === 1 ? " is" : "s are"} available for participation.`, actionLabel: "View polls", priority: "high" }
  }
  if (events.length > 0) {
    return { kind: "event", title: "There is something coming up", detail: `${events.length} upcoming event${events.length === 1 ? " is" : "s are"} available.`, actionLabel: "View events", priority: "medium" }
  }
  const challenge = posts.find((p) => {
    const kind = String(p?.type || p?.kind || "").toLowerCase()
    const body = String(p?.body || p?.title || "").toLowerCase()
    return kind === "challenge" || kind === "activity" || body.includes("challenge:") || body.includes("activity:")
  })
  if (challenge) {
    return { kind: "challenge", title: "A participation opportunity is available", detail: String(challenge.title || challenge.body || "Join the active community activity.").slice(0, 150), actionLabel: "View activity", priority: "medium" }
  }
  if (chatUnread > 0 && input.chatAvailable) {
    return { kind: "chat", title: "Your community conversation is active", detail: `${chatUnread} unread chat message${chatUnread === 1 ? "" : "s"}.`, actionLabel: "Open chat", priority: "medium" }
  }
  return { kind: "explore", title: "Keep participating", detail: "Explore the board, discussions and community activities when you are ready.", actionLabel: "Open board", priority: "low" }
}
