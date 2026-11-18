/**
 * Mute & Restrict policy — distinct from Block.
 *
 * Uses Social Graph snapshot only (no second state system).
 *
 * MUTE
 *  - Suppresses content visibility (feed posts, stories) from that user
 *  - Suppresses notifications from that user
 *  - Does NOT end follow / friend / match
 *  - Does NOT hide profile or prevent intentional messaging by default
 *
 * RESTRICT
 *  - Reduces what the restricted user can do to the actor (comments, reactions,
 *    story replies, some messaging privileges) according to privacy rules
 *  - Does NOT remove the relationship
 *  - Does NOT fully hide them from discovery the way block does
 *
 * BLOCK (see block-enforcement + graph transitions)
 *  - Ends / prevents relationship edges and hides across the platform
 */

import type { SocialGraphSnapshot } from "./social-graph"
import {
  isBlocked,
  isMuted,
  isRestricted,
} from "./social-graph"

export type SoftLimitKind = "mute" | "restrict"

export function mutedIds(graph: SocialGraphSnapshot): string[] {
  return [...(graph.mutedIds || [])]
}

export function restrictedIds(graph: SocialGraphSnapshot): string[] {
  return [...(graph.restrictedIds || [])]
}

/** Content from this author should be hidden in passive feeds/stories */
export function shouldHideContentFrom(graph: SocialGraphSnapshot, authorId: string): boolean {
  if (!authorId) return false
  if (isBlocked(graph, authorId)) return true
  if (isMuted(graph, authorId)) return true
  return false
}

/** Notification from this actor should be suppressed */
export function shouldSuppressNotificationFrom(graph: SocialGraphSnapshot, actorId: string): boolean {
  if (!actorId) return false
  if (isBlocked(graph, actorId)) return true
  if (isMuted(graph, actorId)) return true
  return false
}

/**
 * Restricted user limitations toward the actor:
 * - cannot comment / react freely on actor content
 * - messaging may be limited (caller uses permission engine)
 */
export function isInteractionRestricted(graph: SocialGraphSnapshot, otherId: string): boolean {
  if (isBlocked(graph, otherId)) return true
  return isRestricted(graph, otherId)
}

/** Filter passive content lists (feed, stories) for mute + block */
export function filterMutedContent<T>(
  items: T[],
  graph: SocialGraphSnapshot,
  getAuthorId: (item: T) => string | undefined | null
): T[] {
  return items.filter((item) => {
    const id = getAuthorId(item)
    if (!id) return true
    return !shouldHideContentFrom(graph, id)
  })
}

/** Filter notifications for mute + block */
export function filterMutedNotifications<T>(
  items: T[],
  graph: SocialGraphSnapshot,
  getActorId: (item: T) => string | undefined | null
): T[] {
  return items.filter((item) => {
    const id = getActorId(item)
    if (!id) return true
    return !shouldSuppressNotificationFrom(graph, id)
  })
}

export function describeSoftLimit(kind: SoftLimitKind): string {
  if (kind === "mute") {
    return "Muted: their posts, stories, and notifications are hidden. Your connection stays."
  }
  return "Restricted: their ability to interact with you is limited. Your connection stays."
}
