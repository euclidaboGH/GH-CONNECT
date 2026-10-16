/**
 * Home community pulse — signal, not noise.
 * Surfaces at most a few meaningful items from communities the user already belongs to.
 * Never fabricates communities, events, or members.
 */

import { listMyCommunitiesForHome } from "@/lib/domains/adapters/my-communities-home"
import {
  buildCommunityParticipationHub,
  formatEventWhen,
} from "@/lib/domains/adapters/community-participation-hub"
import type { CommunityRowLike } from "@/lib/domains/adapters/community-membership-adapter"

export interface HomeCommunityPulseItem {
  communityId: string
  communityName: string
  kind: "event" | "community"
  title: string
  subtitle: string
}

export interface HomeCommunityPulse {
  items: HomeCommunityPulseItem[]
  myCommunityCount: number
  hasSignal: boolean
}

export function buildHomeCommunityPulse(input: {
  viewerId: string
  conversations: CommunityRowLike[]
  blockedUserIds?: string[]
  maxItems?: number
}): HomeCommunityPulse {
  const maxItems = input.maxItems ?? 3
  const mine = listMyCommunitiesForHome(input.conversations, input.viewerId, {
    blockedUserIds: input.blockedUserIds,
    limit: 12,
  })

  const items: HomeCommunityPulseItem[] = []
  const rowById = new Map((input.conversations || []).map((r) => [r.id, r]))

  for (const c of mine) {
    if (items.length >= maxItems) break
    const row = rowById.get(c.id) as any
    if (!row) continue
    const hub = buildCommunityParticipationHub({
      communityId: c.id,
      events: row.events || row.scheduledEvents || [],
      resources: row.resources || [],
      boardPosts: row.boardPosts || [],
    })
    if (hub.nextEvent) {
      items.push({
        communityId: c.id,
        communityName: c.name,
        kind: "event",
        title: hub.nextEvent.title,
        subtitle: `${c.name} · ${formatEventWhen(hub.nextEvent.startsAt)}`,
      })
    }
  }

  // Fill with communities (no event) only if we still have slots — keeps Home calm
  if (items.length < maxItems) {
    for (const c of mine) {
      if (items.length >= maxItems) break
      if (items.some((i) => i.communityId === c.id)) continue
      items.push({
        communityId: c.id,
        communityName: c.name,
        kind: "community",
        title: c.name,
        subtitle: c.description || c.category || "Your community",
      })
    }
  }

  return {
    items,
    myCommunityCount: mine.length,
    hasSignal: items.length > 0,
  }
}
