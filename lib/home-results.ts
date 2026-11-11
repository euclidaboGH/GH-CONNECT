export type HomeResultMetric = {
  id: "identity" | "network" | "messages" | "communities"
  label: string
  value: string
  detail: string
  state: "ready" | "attention" | "start"
}

export function buildHomeResultMetrics(input: {
  profileCompletionPercent: number | null
  friendsCount: number
  followingCount: number
  messagesNeedingAttention: number
  communitiesCount: number
}): HomeResultMetric[] {
  const completion = Math.max(0, Math.min(100, input.profileCompletionPercent ?? 0))
  const network = Math.max(0, input.friendsCount) + Math.max(0, input.followingCount)

  return [
    {
      id: "identity",
      label: "Identity",
      value: `${completion}%`,
      detail: completion >= 100 ? "Ready to represent you" : "Complete your profile",
      state: completion >= 100 ? "ready" : "attention",
    },
    {
      id: "network",
      label: "Network",
      value: String(network),
      detail: network > 0 ? "People in your circle" : "Start discovering people",
      state: network > 0 ? "ready" : "start",
    },
    {
      id: "messages",
      label: "Messages",
      value: String(Math.max(0, input.messagesNeedingAttention)),
      detail: input.messagesNeedingAttention > 0 ? "Need your attention" : "Nothing waiting",
      state: input.messagesNeedingAttention > 0 ? "attention" : "ready",
    },
    {
      id: "communities",
      label: "Communities",
      value: String(Math.max(0, input.communitiesCount)),
      detail: input.communitiesCount > 0 ? "Places you participate" : "Find your first circle",
      state: input.communitiesCount > 0 ? "ready" : "start",
    },
  ]
}
