/**
 * MatchingDomain — intentional mutual interest (Match ≠ Friend).
 *
 * Connection / friendship = social graph mutual relationship.
 * Match = mutual intentional interest under shared intentions.
 *
 * A Match does NOT auto-create friendship unless product explicitly does so.
 *
 * Intent categories: dating, friendship, professional, collaboration,
 * mentorship, learning, shared_interests.
 *
 * Quality scoring is explainable and never claims guaranteed compatibility.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import type {
  Candidate,
  MatchEntry,
  MatchIntention,
  Profile,
  Like,
} from "../ghc-types"

export const MATCH_INTENTIONS: MatchIntention[] = [
  "dating",
  "friendship",
  "professional",
  "collaboration",
  "mentorship",
  "learning",
  "shared_interests",
]

/** Map legacy primaryMode → default open intentions */
export function intentionsFromPrimaryMode(mode?: string): MatchIntention[] {
  switch (mode) {
    case "dating":
      return ["dating", "shared_interests"]
    case "friendship":
      return ["friendship", "shared_interests", "learning"]
    case "networking":
      return ["professional", "collaboration", "mentorship", "learning"]
    default:
      return ["friendship", "shared_interests"]
  }
}

export interface MatchQualityResult {
  score: number
  reasons: string[]
  sharedIntentions: MatchIntention[]
}

export function createMatchingDomain(deps: {
  currentUserId?: string
  getProfile: () => Profile
  getMatches: () => MatchEntry[]
  getLikes: () => Like[]
  getCandidates: () => Candidate[]
  getBlockedUsers: () => string[]
  getFriendIds?: () => string[]
  getFollowingIds?: () => string[]
  /** User-controlled open intentions (privacy-sensitive — keep local) */
  getOpenIntentions?: () => MatchIntention[]
}) {
  const actorId = deps.currentUserId || "current-user"

  function openIntentions(): MatchIntention[] {
    const explicit = deps.getOpenIntentions?.()
    if (explicit && explicit.length) return explicit
    return intentionsFromPrimaryMode(deps.getProfile().primaryMode)
  }

  /**
   * Explainable quality signals — scores are relative ranking aids, not compatibility guarantees.
   */
  function evaluateQuality(
    candidate: Candidate,
    signals?: {
      mutualConnectionIds?: string[]
      communityOverlap?: boolean
      locationEnabled?: boolean
    }
  ): MatchQualityResult {
    const profile = deps.getProfile()
    const reasons: string[] = []
    let score = 0

    const myIntentions = openIntentions()
    const theirTypes = ((candidate as any).relationshipType ||
      (candidate as any).intentions ||
      []) as MatchIntention[]
    const sharedIntentions = myIntentions.filter((i) =>
      theirTypes.length ? theirTypes.includes(i) : true
    )
    if (theirTypes.length && sharedIntentions.length) {
      score += sharedIntentions.length * 8
      reasons.push(
        sharedIntentions.length === 1
          ? `Both open to ${labelIntention(sharedIntentions[0])}`
          : `Shared intentions: ${sharedIntentions.map(labelIntention).join(", ")}`
      )
    } else if (!theirTypes.length) {
      // Soft: unknown intentions — small base from mode only
      score += 2
    }

    const myInterests = profile.interests || []
    const sharedInterests = (candidate.interests || []).filter((i) =>
      myInterests.includes(i)
    )
    if (sharedInterests.length) {
      score += Math.min(sharedInterests.length * 4, 16)
      reasons.push(
        sharedInterests.length === 1
          ? `Shared interest: ${sharedInterests[0]}`
          : `${sharedInterests.length} shared interests`
      )
    }

    const mutuals = signals?.mutualConnectionIds || []
    if (mutuals.includes(candidate.id)) {
      score += 10
      reasons.push("You may share connections")
    }

    if (signals?.communityOverlap) {
      score += 6
      reasons.push("Community overlap")
    }

    const myProfession = profile.profession
    if (myProfession && (candidate as any).profession === myProfession) {
      score += 7
      reasons.push("Similar profession")
    }

    if (profile.education && (candidate as any).education === profile.education) {
      score += 4
      reasons.push("Similar education")
    }

    const locationOk = signals?.locationEnabled !== false
    if (locationOk && profile.city && candidate.location) {
      const loc = candidate.location.toLowerCase()
      if (loc.includes(profile.city.toLowerCase()) || loc.includes((profile.country || "").toLowerCase())) {
        score += 5
        reasons.push("Nearby or same area")
      }
    }

    if (candidate.online || (candidate as any).isOnline) {
      score += 3
      reasons.push("Recently active")
    }

    if (candidate.verified) {
      score += 2
      reasons.push("Verified profile")
    }

    // Cap & floor for display
    score = Math.max(0, Math.min(score, 100))
    if (!reasons.length) {
      reasons.push("Suggested based on your discovery preferences")
    }

    return { score, reasons, sharedIntentions }
  }

  function hasOutgoingLike(userId: string) {
    return deps.getLikes().some((l) => l.fromUserId === actorId && l.toUserId === userId)
  }

  function hasIncomingLike(userId: string) {
    return deps.getLikes().some((l) => l.fromUserId === userId && l.toUserId === actorId)
  }

  function isMatched(userId: string) {
    return deps.getMatches().some((m) => m.userId === userId)
  }

  return {
    openIntentions,

    /** True if match exists — does not imply friendship */
    isMatched,

    hasOutgoingLike,
    hasIncomingLike,

    evaluateQuality,

    /** Rank candidates for match suggestions with explanations */
    recommendMatches(
      limit = 20,
      signals?: Parameters<typeof evaluateQuality>[1]
    ): Array<{ candidate: Candidate; quality: MatchQualityResult }> {
      const blocked = new Set(deps.getBlockedUsers())
      const matched = new Set(deps.getMatches().map((m) => m.userId))
      const friends = new Set(deps.getFriendIds?.() || [])

      return deps
        .getCandidates()
        .filter((c) => !blocked.has(c.id) && !matched.has(c.id) && c.id !== actorId)
        .map((candidate) => ({
          candidate,
          quality: evaluateQuality(candidate, signals),
        }))
        .filter((row) => {
          // Prefer some shared signal; still allow soft suggestions
          return row.quality.score >= 2
        })
        .sort((a, b) => b.quality.score - a.quality.score)
        .slice(0, limit)
    },

    /**
     * Express intentional interest (like). Does not create a Match alone.
     * Match is only created when mutual interest is detected (see confirmMutualMatch).
     */
    async expressInterest(
      userId: string,
      options?: { superlike?: boolean; intentions?: MatchIntention[] }
    ): Promise<
      MutationResult<{
        liked: boolean
        mutual: boolean
        alreadyMatched: boolean
      }>
    > {
      return runMutation({
        name: "matching.expressInterest",
        actorId,
        input: { userId, options },
        authorize: (i) => {
          if (!i.userId || i.userId === actorId) return "Invalid user"
          if (deps.getBlockedUsers().includes(i.userId)) return "Unavailable"
          return null
        },
        mutate: (i) => {
          const alreadyMatched = isMatched(i.userId)
          const mutual = hasIncomingLike(i.userId)
          return {
            liked: true,
            mutual: mutual && !alreadyMatched,
            alreadyMatched,
          }
        },
        eventType: "LIKE_ADDED",
        eventPayload: (d, i) => ({ userId: i.userId, mutual: d.mutual }),
      })
    },

    /**
     * Create Match only on mutual consent. Never adds friendship/connection edges.
     */
    async confirmMutualMatch(input: {
      userId: string
      userName: string
      userPhoto: string
      online?: boolean
      intentions?: MatchIntention[]
      reasons?: string[]
      qualityScore?: number
    }): Promise<MutationResult<{ match: MatchEntry; created: boolean }>> {
      return runMutation({
        name: "matching.confirmMutualMatch",
        actorId,
        input,
        authorize: (i) => {
          if (deps.getBlockedUsers().includes(i.userId)) return "Unavailable"
          if (isMatched(i.userId)) return null // idempotent — no duplicate match
          // Mutual consent only: the other party must already have expressed interest
          if (!hasIncomingLike(i.userId)) {
            return "Mutual interest required"
          }
          return null
        },
        mutate: (i) => {
          if (isMatched(i.userId)) {
            return {
              match: deps.getMatches().find((m) => m.userId === i.userId)!,
              created: false,
            }
          }
          const myIntentions = i.intentions?.length ? i.intentions : openIntentions()
          const match: MatchEntry = {
            id: `match_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            userId: i.userId,
            userName: i.userName,
            userPhoto: i.userPhoto || "/placeholder.svg?height=80&width=80",
            matchedAt: Date.now(),
            online: Boolean(i.online),
            intentions: myIntentions,
            reasons: i.reasons,
            qualityScore: i.qualityScore,
          }
          return { match, created: true }
        },
        eventType: "MATCH_CREATED",
        eventPayload: (d) => ({
          matchId: d.match.id,
          userId: d.match.userId,
          // Explicit: no friendship edge is created by this event
          createsFriendship: false,
        }),
      })
    },

    async unmatch(userId: string): Promise<MutationResult<{ userId: string }>> {
      return runMutation({
        name: "matching.unmatch",
        actorId,
        input: { userId },
        authorize: (i) => {
          if (!isMatched(i.userId)) return "Not matched"
          return null
        },
        mutate: (i) => ({ userId: i.userId }),
        eventType: "MATCH_REMOVED",
        eventPayload: (d) => d,
      })
    },

    /**
     * Boundary helper: Match list vs Friends list must not be conflated.
     */
    lists() {
      const matches = deps.getMatches()
      const friends = new Set(deps.getFriendIds?.() || [])
      return {
        matches,
        /** Matches who are not friends (pure intentional matches) */
        matchesOnly: matches.filter((m) => !friends.has(m.userId)),
        /** Matches who also happen to be friends (orthogonal states) */
        matchesWhoAreFriends: matches.filter((m) => friends.has(m.userId)),
      }
    },
  }
}

function labelIntention(i: MatchIntention): string {
  switch (i) {
    case "dating":
      return "Dating"
    case "friendship":
      return "Friendship"
    case "professional":
      return "Professional networking"
    case "collaboration":
      return "Collaboration"
    case "mentorship":
      return "Mentorship"
    case "learning":
      return "Learning"
    case "shared_interests":
      return "Shared interests"
    default:
      return i
  }
}

export type MatchingDomain = ReturnType<typeof createMatchingDomain>
