export type HomeFocusKind = "messages" | "communities" | "discovery" | "profile" | "create"

export type HomeFocus = {
  kind: HomeFocusKind
  title: string
  detail: string
  cta: string
  priority: number
  reason: string
  target: string
}

export function buildHomePersonalization(input: {
  messagesNeedingAttention: number
  communityInvites: number
  communitySignals: number
  communitiesCount: number
  friendsOrFollowing: number
  profileCompletion: number | null
  hasOwnPost: boolean
  interestsCount: number
}): { primary: HomeFocus | null; secondary: HomeFocus[] } {
  const candidates: HomeFocus[] = []

  if (input.messagesNeedingAttention > 0) {
    candidates.push({
      kind: "messages",
      title: "Continue the conversations that need you",
      detail: `${input.messagesNeedingAttention} conversation${input.messagesNeedingAttention === 1 ? "" : "s"} currently need attention.`,
      cta: "Open messages",
      priority: 100,
      reason: "You have active conversations waiting for a response.",
      target: "messages",
    })
  }

  if (input.communityInvites > 0) {
    candidates.push({
      kind: "communities",
      title: "Review your community invitations",
      detail: `${input.communityInvites} invitation${input.communityInvites === 1 ? "" : "s"} is ready for your decision.`,
      cta: "Review invites",
      priority: 92,
      reason: "You have invitations that require your choice.",
      target: "communities",
    })
  }

  if (input.communitySignals > 0 && input.communitiesCount > 0) {
    candidates.push({
      kind: "communities",
      title: "Take part where your communities are active",
      detail: `${input.communitySignals} recent signal${input.communitySignals === 1 ? "" : "s"} can lead you back to a community you already joined.`,
      cta: "Open communities",
      priority: 84,
      reason: "Your existing communities have current activity.",
      target: "communities",
    })
  }

  if (input.profileCompletion !== null && input.profileCompletion < 100) {
    candidates.push({
      kind: "profile",
      title: "Strengthen your GreenHaven identity",
      detail: `Your profile is ${input.profileCompletion}% complete.`,
      cta: "Complete profile",
      priority: 76,
      reason: "A clearer identity helps people and communities understand who you are.",
      target: "profile",
    })
  }

  if (input.friendsOrFollowing === 0 && input.interestsCount > 0) {
    candidates.push({
      kind: "discovery",
      title: "Turn your interests into connections",
      detail: "Explore people, creators and communities related to the interests you selected.",
      cta: "Explore discovery",
      priority: 70,
      reason: "Your interests can guide a more relevant discovery experience.",
      target: "discover",
    })
  }

  if (!input.hasOwnPost && input.friendsOrFollowing > 0) {
    candidates.push({
      kind: "create",
      title: "Share something with your circle",
      detail: "Start a conversation, publish an update, or share something useful.",
      cta: "Create a post",
      priority: 62,
      reason: "You already have a network that can participate in your next post.",
      target: "home",
    })
  }

  candidates.sort((a, b) => b.priority - a.priority)
  return { primary: candidates[0] || null, secondary: candidates.slice(1, 3) }
}
