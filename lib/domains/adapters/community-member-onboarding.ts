/**
 * Community member onboarding — non-financial, session/local preference only.
 * Tracks first-visit welcome completion per user × community.
 * Does NOT claim membership; membership remains domain-authoritative.
 */

import type { CommunityJoinReasonId } from "@/lib/domains/contracts/communities"
import { COMMUNITY_JOIN_REASON_OPTIONS } from "@/lib/domains/contracts/communities"

const WELCOME_KEY = "ghc.community.welcomeDone.v1"
const CHECKLIST_KEY = "ghc.community.onboardingChecklist.v1"

export type OnboardingStepId =
  | "read_welcome"
  | "review_rules"
  | "meet_people"
  | "first_post"
  | "explore_events"

export const ONBOARDING_CHECKLIST: {
  id: OnboardingStepId
  label: string
  description: string
}[] = [
  {
    id: "read_welcome",
    label: "Read the welcome",
    description: "See why this community exists and how to participate.",
  },
  {
    id: "review_rules",
    label: "Review community rules",
    description: "Stay safe and respectful with other members.",
  },
  {
    id: "meet_people",
    label: "Meet people here",
    description: "Connect with members who share your interests.",
  },
  {
    id: "first_post",
    label: "Say hello on the board",
    description: "Introduce yourself when you are ready — no pressure.",
  },
  {
    id: "explore_events",
    label: "Explore events & activities",
    description: "See what is happening next in this community.",
  },
]

function readMap(key: string): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(key: string, map: Record<string, boolean>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

function compositeKey(userId: string, communityId: string) {
  return `${userId || "anon"}::${communityId}`
}

export function isWelcomeComplete(userId: string, communityId: string): boolean {
  const map = readMap(WELCOME_KEY)
  return !!map[compositeKey(userId, communityId)]
}

export function markWelcomeComplete(userId: string, communityId: string): void {
  const map = readMap(WELCOME_KEY)
  map[compositeKey(userId, communityId)] = true
  writeMap(WELCOME_KEY, map)
}

export function clearWelcomeComplete(userId: string, communityId: string): void {
  const map = readMap(WELCOME_KEY)
  delete map[compositeKey(userId, communityId)]
  writeMap(WELCOME_KEY, map)
}

export function getChecklistProgress(
  userId: string,
  communityId: string
): Record<OnboardingStepId, boolean> {
  const map = readMap(CHECKLIST_KEY)
  const prefix = compositeKey(userId, communityId) + "::"
  const out = {} as Record<OnboardingStepId, boolean>
  for (const step of ONBOARDING_CHECKLIST) {
    out[step.id] = !!map[prefix + step.id]
  }
  return out
}

export function markChecklistStep(
  userId: string,
  communityId: string,
  step: OnboardingStepId
): void {
  const map = readMap(CHECKLIST_KEY)
  map[compositeKey(userId, communityId) + "::" + step] = true
  writeMap(CHECKLIST_KEY, map)
}

export function reasonLabels(ids: CommunityJoinReasonId[]): string[] {
  return ids
    .map((id) => COMMUNITY_JOIN_REASON_OPTIONS.find((o) => o.id === id)?.label)
    .filter(Boolean) as string[]
}

export interface MemberWelcomeModel {
  communityId: string
  communityName: string
  welcomeMessage?: string
  rules: string[]
  joinReasons: string[]
  checklist: { id: OnboardingStepId; label: string; description: string; done: boolean }[]
  completedCount: number
  totalCount: number
  showWelcome: boolean
}

export function buildMemberWelcomeModel(input: {
  userId: string
  communityId: string
  communityName: string
  welcomeMessage?: string
  rules: string[]
  joinReasons?: CommunityJoinReasonId[]
}): MemberWelcomeModel {
  const progress = getChecklistProgress(input.userId, input.communityId)
  const checklist = ONBOARDING_CHECKLIST.map((s) => ({
    ...s,
    done: !!progress[s.id],
  }))
  const completedCount = checklist.filter((c) => c.done).length
  return {
    communityId: input.communityId,
    communityName: input.communityName,
    welcomeMessage: input.welcomeMessage,
    rules: (input.rules || []).slice(0, 6),
    joinReasons: reasonLabels(input.joinReasons || []),
    checklist,
    completedCount,
    totalCount: checklist.length,
    showWelcome: !isWelcomeComplete(input.userId, input.communityId),
  }
}
