/**
 * Privacy-safe "people you may know" within a community.
 * Uses existing members + connection graph signals — never fabricates users.
 */

import type { ExplainableReason } from "@/lib/domains/contracts/discovery"
import { filterMemberIdsForViewer } from "@/lib/domains/adapters/community-membership-adapter"
import { scoreCommunityMemberSuggestion } from "@/lib/domains/adapters/shared-community-bridge"

export interface CommunityMemberSuggestion {
  userId: string
  displayName: string
  avatarUrl?: string
  reasons: ExplainableReason[]
  connectionState?: string
}

export interface MemberDirectoryEntry {
  id: string
  name?: string
  photo?: string
  interests?: string[]
}

export function buildPeopleYouMayKnowInCommunity(input: {
  viewerId: string
  communityId: string
  memberIds: string[]
  /** Optional profile directory from session candidates */
  directory?: MemberDirectoryEntry[]
  friendIds?: string[]
  followingIds?: string[]
  blockedUserIds?: string[]
  viewerInterests?: string[]
  limit?: number
}): CommunityMemberSuggestion[] {
  const {
    viewerId,
    memberIds,
    directory = [],
    friendIds = [],
    followingIds = [],
    blockedUserIds = [],
    viewerInterests = [],
    limit = 8,
  } = input

  if (!viewerId) return []

  const friends = new Set(friendIds)
  const following = new Set(followingIds)
  const dir = new Map(directory.map((d) => [d.id, d]))

  const candidates = filterMemberIdsForViewer(memberIds, viewerId, blockedUserIds)
  const out: CommunityMemberSuggestion[] = []

  for (const id of candidates) {
    if (out.length >= limit) break
    // Skip already connected friends for "may know" — they are known
    if (friends.has(id)) continue

    const profile = dir.get(id)
    const reasons: ExplainableReason[] = [
      {
        code: "shared_community",
        label: "Shared community",
        detail: "You’re both members of this community — a natural place to connect.",
      },
    ]

    const interests = profile?.interests || []
    const shared = interests.filter((i) =>
      viewerInterests.map((x) => x.toLowerCase()).includes(String(i).toLowerCase())
    )
    if (shared.length) {
      reasons.push({
        code: "shared_interests",
        label: "Shared interests",
        detail: `You share interests in this community (${shared.slice(0, 2).join(", ")}).`,
      })
    }

    // Mutual connection signal: viewer follows them or they appear in friends-of — limited without graph
    if (following.has(id)) {
      reasons.push({
        code: "already_following",
        label: "Following",
        detail: "You already follow this member.",
      })
    }

    const displayName =
      profile?.name ||
      (id.length <= 12 ? id.charAt(0).toUpperCase() + id.slice(1) : "Member")

    out.push({
      userId: id,
      displayName,
      avatarUrl: profile?.photo,
      reasons,
      connectionState: following.has(id) ? "following" : "none",
    })
  }

  out.sort((a, b) => {
    const sb = scoreCommunityMemberSuggestion({
      reasonCodes: b.reasons.map((r) => r.code),
      isFollowing: b.connectionState === "following",
    })
    const sa = scoreCommunityMemberSuggestion({
      reasonCodes: a.reasons.map((r) => r.code),
      isFollowing: a.connectionState === "following",
    })
    return sb - sa
  })
  return out.slice(0, limit)
}
