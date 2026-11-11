/**
 * Community ↔ Connection graph bridge.
 * Produces explainable relationship lines without fabricating graph edges.
 *
 * Example: "You know this person through GreenHaven Community X"
 */

import type { ExplainableReason } from "@/lib/domains/contracts/types"

export interface SharedCommunityRef {
  id: string
  name: string
}

export function intersectCommunityRefs(
  viewer: SharedCommunityRef[],
  subject: SharedCommunityRef[]
): SharedCommunityRef[] {
  const byId = new Map(viewer.map((c) => [c.id, c]))
  const byName = new Map(viewer.map((c) => [c.name.toLowerCase(), c]))
  const out: SharedCommunityRef[] = []
  const seen = new Set<string>()
  for (const s of subject) {
    const hit = byId.get(s.id) || byName.get(s.name.toLowerCase())
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id)
      out.push(hit)
    }
  }
  return out
}

/** Primary relationship line for cards and profiles */
export function relationshipThroughCommunities(
  shared: SharedCommunityRef[],
  opts?: { maxNames?: number }
): string | null {
  if (!shared.length) return null
  const max = opts?.maxNames ?? 2
  const names = shared.slice(0, max).map((c) => c.name)
  if (shared.length === 1) {
    return `You know this person through ${names[0]}`
  }
  if (shared.length === 2) {
    return `You know this person through ${names[0]} and ${names[1]}`
  }
  return `You know this person through ${names.join(", ")} and ${shared.length - max} more`
}

export function sharedCommunityReasons(shared: SharedCommunityRef[]): ExplainableReason[] {
  if (!shared.length) return []
  const line = relationshipThroughCommunities(shared)
  return [
    {
      code: "shared_community",
      label: shared.length === 1 ? "Shared community" : "Shared communities",
      detail: line || `Shared ${shared.length} communities`,
    },
  ]
}

/**
 * Rank people in a community by connection relevance:
 * shared interests > following > bare membership
 */
export function scoreCommunityMemberSuggestion(input: {
  reasonCodes: string[]
  isFollowing?: boolean
}): number {
  let score = 1
  if (input.reasonCodes.includes("shared_interests")) score += 3
  if (input.reasonCodes.includes("already_following")) score += 2
  if (input.reasonCodes.includes("shared_community")) score += 1
  if (input.isFollowing) score += 1
  return score
}
