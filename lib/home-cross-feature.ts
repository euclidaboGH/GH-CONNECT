export type HomeCrossFeatureKind = "messages" | "communities" | "discovery" | "profile" | "create" | "wallet" | "rewards"

export type HomeCrossFeatureEvidence = "server" | "profile" | "activity" | "relationship"

export type HomeCrossFeatureSignal = {
  kind: HomeCrossFeatureKind
  title: string
  detail: string
  cta: string
  reason: string
  target: string
  priority: number
  evidence: HomeCrossFeatureEvidence
}

/**
 * Cross-feature continuity model for Home.
 * Every signal must come from already-authoritative/read state supplied by the caller.
 * This model never invents activity, balances, opportunities or outcomes.
 */
export function buildHomeCrossFeatureSignals(input: {
  messagesNeedingAttention: number
  communityInvites: number
  communitySignals: number
  communitiesCount: number
  friendsOrFollowing: number
  profileCompletion: number | null
  hasOwnPost: boolean
  interestsCount: number
  dailyClaimable: boolean
  walletReady: boolean
  pendingGhc: number | null
  lockedGhc: number | null
}): HomeCrossFeatureSignal[] {
  const signals: HomeCrossFeatureSignal[] = []

  if (input.dailyClaimable) {
    signals.push({
      kind: "rewards",
      title: "Your Daily Claim is ready",
      detail: "Open Rewards to review the server-confirmed claim state for today.",
      cta: "Open Daily Claim",
      reason: "The authoritative daily-claim state says today's claim is available.",
      target: "rewards",
      priority: 88,
      evidence: "server",
    })
  }

  if (input.walletReady && ((input.pendingGhc ?? 0) > 0 || (input.lockedGhc ?? 0) > 0)) {
    const parts: string[] = []
    if ((input.pendingGhc ?? 0) > 0) parts.push("pending GHC")
    if ((input.lockedGhc ?? 0) > 0) parts.push("reserved GHC")
    signals.push({
      kind: "wallet",
      title: "Review your wallet activity",
      detail: `Your wallet currently shows ${parts.join(" and ")}.`,
      cta: "Open wallet",
      reason: "The wallet read model has server-confirmed balances that may need review.",
      target: "wallet",
      priority: 87,
      evidence: "server",
    })
  }

  if (input.messagesNeedingAttention > 0) {
    signals.push({ kind: "messages", title: "Continue the conversations that need you", detail: `${input.messagesNeedingAttention} conversation${input.messagesNeedingAttention === 1 ? "" : "s"} currently need attention.`, cta: "Open messages", reason: "You have active conversations waiting for a response.", target: "messages", priority: 100, evidence: "activity" })
  }
  if (input.communityInvites > 0) {
    signals.push({ kind: "communities", title: "Review your community invitations", detail: `${input.communityInvites} invitation${input.communityInvites === 1 ? "" : "s"} is ready for your decision.`, cta: "Review invites", reason: "You have invitations that require your choice.", target: "communities", priority: 92, evidence: "activity" })
  }
  if (input.communitySignals > 0 && input.communitiesCount > 0) {
    signals.push({ kind: "communities", title: "Take part where your communities are active", detail: `${input.communitySignals} recent signal${input.communitySignals === 1 ? "" : "s"} can lead you back to a community you already joined.`, cta: "Open communities", reason: "Your existing communities have current activity.", target: "communities", priority: 84, evidence: "activity" })
  }
  if (input.profileCompletion !== null && input.profileCompletion < 100) {
    signals.push({ kind: "profile", title: "Strengthen your GreenHaven identity", detail: `Your profile is ${input.profileCompletion}% complete.`, cta: "Complete profile", reason: "A clearer identity helps people and communities understand who you are.", target: "profile", priority: 76, evidence: "profile" })
  }
  if (input.friendsOrFollowing === 0 && input.interestsCount > 0) {
    signals.push({ kind: "discovery", title: "Turn your interests into connections", detail: "Explore people, creators and communities related to the interests you selected.", cta: "Explore discovery", reason: "Your interests can guide a more relevant discovery experience.", target: "discover", priority: 70, evidence: "profile" })
  }
  if (!input.hasOwnPost && input.friendsOrFollowing > 0) {
    signals.push({ kind: "create", title: "Share something with your circle", detail: "Start a conversation, publish an update, or share something useful.", cta: "Create a post", reason: "You already have a network that can participate in your next post.", target: "home", priority: 62, evidence: "profile" })
  }

  return signals.sort((a, b) => b.priority - a.priority)
}
