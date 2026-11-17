/**
 * Privacy-safe profile connection context for "how you may know this person".
 * Only uses signals the viewer already has access to in-session (no private fields).
 */

import { buildExplainableReasons } from "@/lib/domains/contracts/discovery"
import type { ExplainableReason } from "@/lib/domains/contracts/types"
import { normalizeIntents, type ConnectionIntentId } from "@/lib/connection-intents"
import {
  intersectCommunityRefs,
  relationshipThroughCommunities,
  type SharedCommunityRef,
} from "@/lib/domains/adapters/shared-community-bridge"

export interface ProfileConnectionContextInput {
  viewer: {
    interests?: string[]
    intents?: ConnectionIntentId[]
    communityIds?: string[]
    communityNames?: string[]
    friendIds?: string[]
  }
  subject: {
    id: string
    interests?: string[]
    intents?: string[]
    communityIds?: string[]
    communityNames?: string[]
    friendIds?: string[]
  }
}

export interface ProfileConnectionContext {
  reasons: ExplainableReason[]
  sharedInterests: string[]
  sharedCommunities: string[]
  sharedIntents: ConnectionIntentId[]
  mutualConnectionCount: number
  summary: string
}

export function buildProfileConnectionContext(
  input: ProfileConnectionContextInput
): ProfileConnectionContext {
  const sharedInterests = (input.subject.interests || [])
    .filter((i) =>
      (input.viewer.interests || []).some((v) => String(v).toLowerCase() === String(i).toLowerCase())
    )
    .slice(0, 5)

  const subjectIntents = normalizeIntents(input.subject.intents)
  const sharedIntents = (input.viewer.intents || []).filter((i) => subjectIntents.includes(i))

  const viewerComms = new Set(
    [...(input.viewer.communityIds || []), ...(input.viewer.communityNames || [])].map((x) =>
      String(x).toLowerCase()
    )
  )
  const sharedCommunities = [
    ...(input.subject.communityNames || []),
    ...(input.subject.communityIds || []),
  ]
    .filter((c) => viewerComms.has(String(c).toLowerCase()))
    .slice(0, 3)

  const viewerFriends = new Set((input.viewer.friendIds || []).map(String))
  const mutualConnectionCount = (input.subject.friendIds || []).filter((f) =>
    viewerFriends.has(String(f))
  ).length

  const reasons = buildExplainableReasons({
    sharedInterests,
    sharedCommunities,
    sharedIntents,
  })

  if (mutualConnectionCount > 0) {
    reasons.push({
      code: "mutual_connections",
      label: "Mutual",
      detail:
        mutualConnectionCount === 1
          ? "You have 1 mutual connection"
          : `You have ${mutualConnectionCount} mutual connections`,
    })
  }

  // Prefer human community names for relationship line
  const viewerRefs: SharedCommunityRef[] = [
    ...(input.viewer.communityIds || []).map((id, i) => ({
      id: String(id),
      name: (input.viewer.communityNames || [])[i] || String(id),
    })),
    ...(input.viewer.communityNames || []).map((name, i) => ({
      id: (input.viewer.communityIds || [])[i] || String(name),
      name: String(name),
    })),
  ]
  const subjectRefs: SharedCommunityRef[] = [
    ...(input.subject.communityIds || []).map((id, i) => ({
      id: String(id),
      name: (input.subject.communityNames || [])[i] || String(id),
    })),
    ...(input.subject.communityNames || []).map((name, i) => ({
      id: (input.subject.communityIds || [])[i] || String(name),
      name: String(name),
    })),
  ]
  const sharedRefs = intersectCommunityRefs(viewerRefs, subjectRefs)
  const throughLine = relationshipThroughCommunities(sharedRefs)

  const summary =
    throughLine ||
    (reasons.length > 0
      ? reasons
          .slice(0, 3)
          .map((r) => r.detail)
          .join(" · ")
      : "No shared context yet — view their profile to learn more.")

  return {
    reasons,
    sharedInterests,
    sharedCommunities: sharedRefs.length
      ? sharedRefs.map((r) => r.name)
      : sharedCommunities,
    sharedIntents,
    mutualConnectionCount,
    summary,
  }
}
