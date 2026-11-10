/**
 * Phase 6 — discovery candidate filtering (self, block, mute).
 * Client and server adapters should apply before rendering people cards.
 */
import { idListIncludes } from "@/lib/identity/identity-match"

export type DiscoveryCandidate = {
  id?: string | null
  userId?: string | null
  ghUserId?: string | null
}

export function resolveCandidateId(c: DiscoveryCandidate): string {
  return String(c.userId || c.ghUserId || c.id || "").trim()
}

export function filterDiscoveryCandidates<T extends DiscoveryCandidate>(
  candidates: T[],
  opts: {
    viewerId: string
    blockedIds?: string[] | null
    mutedIds?: string[] | null
    friendIds?: string[] | null
    matchIds?: string[] | null
    excludeFriends?: boolean
    excludeMatches?: boolean
  }
): T[] {
  const viewer = String(opts.viewerId || "").trim()
  const blocked = opts.blockedIds || []
  const muted = opts.mutedIds || []
  const friends = opts.friendIds || []
  const matches = opts.matchIds || []
  return candidates.filter((c) => {
    const id = resolveCandidateId(c)
    if (!id) return false
    if (viewer && idListIncludes([viewer], id)) return false
    if (idListIncludes(blocked, id)) return false
    if (idListIncludes(muted, id)) return false
    if (opts.excludeFriends && idListIncludes(friends, id)) return false
    if (opts.excludeMatches && idListIncludes(matches, id)) return false
    return true
  })
}
