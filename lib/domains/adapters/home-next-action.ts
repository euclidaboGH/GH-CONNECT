/**
 * Home “next best action” — progressive disclosure for first 30 seconds.
 *
 * Informed by:
 * - Mobile UX: one primary activation moment, not a feature tour
 * - Instagram/Facebook: feed + clear secondary intents (messages, communities)
 * - Fintech super-apps: money is one area, not scattered CTAs
 * - Progressive disclosure: show only what matters now
 *
 * Priority order (first match wins):
 * 1. Incomplete profile
 * 2. Unread / attention messages
 * 3. No communities joined → join/discover
 * 4. Empty network → discover people
 * 5. Soft default: engage feed / share presence
 */

export type HomeNextActionId =
  | "complete_profile"
  | "open_messages"
  | "join_community"
  | "discover_people"
  | "explore_feed"

export type HomeNextAction = {
  id: HomeNextActionId
  title: string
  body: string
  cta: string
  /** Tab id for ghc:navigate-tab, or special targets */
  target: "profile" | "messages" | "communities" | "discover" | "home"
  /** Optional event when target alone is not enough */
  event?: "ghc:open-wallet"
  urgency: "high" | "medium" | "low"
}

export type HomeNextActionInput = {
  profileCompletionPercent: number | null
  messagesNeedingAttention: number
  myCommunitiesCount: number
  friendsOrFollowingCount: number
  hasDisplayName: boolean
  hasPhoto: boolean
}

export function resolveHomeNextAction(input: HomeNextActionInput): HomeNextAction {
  const completion = input.profileCompletionPercent
  const profileThin =
    (completion !== null && completion < 70) ||
    !input.hasDisplayName ||
    !input.hasPhoto

  if (profileThin) {
    return {
      id: "complete_profile",
      title: "Finish your profile",
      body: "A photo and short bio help people recognize and trust you.",
      cta: "Edit profile",
      target: "profile",
      urgency: "high",
    }
  }

  if (input.messagesNeedingAttention > 0) {
    return {
      id: "open_messages",
      title:
        input.messagesNeedingAttention === 1
          ? "You have a conversation waiting"
          : `${input.messagesNeedingAttention} conversations need attention`,
      body: "Reply while the thread is fresh — connection compounds.",
      cta: "Open messages",
      target: "messages",
      urgency: "high",
    }
  }

  if (input.myCommunitiesCount === 0) {
    return {
      id: "join_community",
      title: "Join your first community",
      body: "Belonging starts with one group — board, events, and member chat.",
      cta: "Find communities",
      target: "communities",
      urgency: "medium",
    }
  }

  if (input.friendsOrFollowingCount === 0) {
    return {
      id: "discover_people",
      title: "Find people to connect with",
      body: "Discover members by goals and interests — not vanity scores.",
      cta: "Discover",
      target: "discover",
      urgency: "medium",
    }
  }

  return {
    id: "explore_feed",
    title: "You’re set — stay present",
    body: "Scroll the feed, share a moment, or check in with your communities.",
    cta: "View feed",
    target: "home",
    urgency: "low",
  }
}
