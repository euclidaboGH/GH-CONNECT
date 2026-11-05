import type { HomeCrossFeatureSignal } from "@/lib/home-cross-feature"

export type HomePriorityGroup = {
  id: "respond" | "participate" | "build" | "manage"
  label: string
  description: string
  signals: HomeCrossFeatureSignal[]
}

const GROUPS: Array<Omit<HomePriorityGroup, "signals"> & { kinds: HomeCrossFeatureSignal["kind"][] }> = [
  { id: "respond", label: "Respond", description: "Conversations and invitations that may need a decision", kinds: ["messages"] },
  { id: "participate", label: "Participate", description: "Communities and people worth engaging with", kinds: ["communities", "discovery"] },
  { id: "build", label: "Build your presence", description: "Strengthen your identity and share something useful", kinds: ["profile", "create"] },
  { id: "manage", label: "Review and manage", description: "Wallet and reward information available to review", kinds: ["wallet", "rewards"] },
]

/** Organizes already-derived, evidence-backed signals without inventing new activity. */
export function groupHomePriorities(signals: HomeCrossFeatureSignal[]): HomePriorityGroup[] {
  return GROUPS.map(({ kinds, ...group }) => ({
    ...group,
    signals: signals.filter((signal) => kinds.includes(signal.kind)),
  })).filter((group) => group.signals.length > 0)
}
