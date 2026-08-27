/**
 * SocialGraphDomain — single authoritative social relationship domain.
 *
 * Owns: following, followers, friend requests, friends, matches,
 *       blocked, muted, restricted users.
 *
 * Pure helpers remain in lib/social-graph.ts and lib/social-graph-relations.ts.
 * Edge persistence: lib/social-graph-store.ts (repository-like local adapter).
 * UI / Feed / Find / Matches / Messages / Profile must read via selectors here
 * (or session state that is updated only from these mutations).
 */

import {
  canBlock,
  canFollow,
  canConnect,
  canMatch,
  canMessageUser,
  isBlocked as permIsBlocked,
  type PermissionContext,
} from "../permission-engine"
import {
  applyBlockEffects,
  isFollowing as snapIsFollowing,
  isBlocked as snapIsBlocked,
  isMuted as snapIsMuted,
  isMatched as snapIsMatched,
  isFriend as snapIsFriend,
  isRestricted as snapIsRestricted,
  isSuppressed,
  type SocialGraphSnapshot,
} from "../social-graph"
import {
  relationBetween,
  relationFromSnapshot,
  profilePrimaryAction,
  type RelationKind,
} from "../social-graph-relations"
import { socialGraphStore } from "../social-graph-store"
import { runMutation, type MutationResult } from "./mutation-pipeline"
import {
  assertTransition,
  blockClearsContradictions,
  type GraphTransition,
} from "./graph-transitions"

export type GraphCtx = PermissionContext & {
  following: string[]
  followers?: string[]
  blockedUsers: string[]
  mutedUsers?: string[]
  restrictedUsers?: string[]
  matches: { userId: string }[]
  friends: string[]
  /** Outgoing friend request target ids */
  outgoingFriendRequestIds?: string[]
  /** Incoming friend request from ids */
  incomingFriendRequestIds?: string[]
  candidates: { id: string }[]
  conversations: any[]
  /** Backend social edge write (optimistic local already applied) */
  onEdge?: (input: {
    type: string
    targetUserId: string
    meta?: Record<string, unknown>
  }) => void
}

function persistEdge(
  s: GraphCtx,
  type: string,
  targetUserId: string,
  meta?: Record<string, unknown>
) {
  try {
    s.onEdge?.({ type, targetUserId, meta })
  } catch {
    /* never break mutation */
  }
}

function toSnapshot(s: GraphCtx): SocialGraphSnapshot {
  return {
    blockedUsers: s.blockedUsers || [],
    followingIds: s.following || [],
    followersIds: s.followers || [],
    mutedIds: s.mutedUsers || [],
    restrictedIds: s.restrictedUsers || [],
    matchIds: (s.matches || []).map((m) => m.userId),
    friendIds: s.friends || [],
    outgoingRequestIds: s.outgoingFriendRequestIds || [],
    incomingRequestIds: s.incomingFriendRequestIds || [],
  }
}

function transitionGate(s: GraphCtx, other: string, action: GraphTransition): string | null {
  const graph = toSnapshot(s)
  // Prefer store truth for pending requests when session arrays lag
  const hasIncoming =
    (s.incomingFriendRequestIds || []).includes(other) ||
    socialGraphStore.hasEdge(other, s.currentUserId, "friend_request")
  const hasOutgoing =
    (s.outgoingFriendRequestIds || []).includes(other) ||
    socialGraphStore.hasEdge(s.currentUserId, other, "friend_request")
  return assertTransition(action, {
    me: s.currentUserId,
    other,
    graph,
    hasIncomingRequest: hasIncoming,
    hasOutgoingRequest: hasOutgoing,
  })
}

export function createSocialGraphDomain(getCtx: () => GraphCtx) {
  const me = () => getCtx().currentUserId

  return {
    // ── Snapshot / selectors (read model) ─────────────────────────────

    /** Full snapshot for Feed / Find / Matches / Messages / Profile */
    getSnapshot(): SocialGraphSnapshot {
      return toSnapshot(getCtx())
    },

    followingIds(): string[] {
      return [...(getCtx().following || [])]
    },

    followerIds(): string[] {
      return [...(getCtx().followers || [])]
    },

    friendIds(): string[] {
      return [...(getCtx().friends || [])]
    },

    matchIds(): string[] {
      return (getCtx().matches || []).map((m) => m.userId)
    },

    blockedIds(): string[] {
      return [...(getCtx().blockedUsers || [])]
    },

    mutedIds(): string[] {
      return [...(getCtx().mutedUsers || [])]
    },

    restrictedIds(): string[] {
      return [...(getCtx().restrictedUsers || [])]
    },

    outgoingFriendRequestIds(): string[] {
      return [...(getCtx().outgoingFriendRequestIds || [])]
    },

    incomingFriendRequestIds(): string[] {
      return [...(getCtx().incomingFriendRequestIds || [])]
    },

    relationKind(userId: string): RelationKind {
      const s = getCtx()
      return relationBetween(s.currentUserId, userId, s.following, s.followers || [], s.friends, s.blockedUsers, {
        matchIds: (s.matches || []).map((m) => m.userId),
        mutedIds: s.mutedUsers,
        restrictedIds: s.restrictedUsers,
        outgoingRequestIds: s.outgoingFriendRequestIds,
        incomingRequestIds: s.incomingFriendRequestIds,
      })
    },

    relationFromSnapshot(userId: string): RelationKind {
      return relationFromSnapshot(me(), userId, {
        followingIds: getCtx().following || [],
        followerIds: getCtx().followers || [],
        friendIds: getCtx().friends || [],
        matchIds: (getCtx().matches || []).map((m) => m.userId),
        blockedIds: getCtx().blockedUsers || [],
        mutedIds: getCtx().mutedUsers,
        restrictedIds: getCtx().restrictedUsers,
        outgoingRequestIds: getCtx().outgoingFriendRequestIds,
        incomingRequestIds: getCtx().incomingFriendRequestIds,
      })
    },

    profileAction(userId: string) {
      return profilePrimaryAction(this.relationKind(userId))
    },

    isFollowing(userId: string) {
      return snapIsFollowing(toSnapshot(getCtx()), userId)
    },

    isFollower(userId: string) {
      return (getCtx().followers || []).includes(userId)
    },

    isFriend(userId: string) {
      return snapIsFriend(toSnapshot(getCtx()), userId)
    },

    isMutual(userId: string) {
      const s = getCtx()
      return s.following.includes(userId) && (s.followers || []).includes(userId)
    },

    isMatched(userId: string) {
      return snapIsMatched(toSnapshot(getCtx()), userId)
    },

    isBlocked(userId: string) {
      return snapIsBlocked(toSnapshot(getCtx()), userId) || permIsBlocked(getCtx(), userId)
    },

    isMuted(userId: string) {
      return snapIsMuted(toSnapshot(getCtx()), userId)
    },

    isRestricted(userId: string) {
      return snapIsRestricted(toSnapshot(getCtx()), userId)
    },

    isSuppressed(userId: string) {
      return isSuppressed(toSnapshot(getCtx()), userId)
    },

    /** System-wide: hide any author whose id is blocked or restricted */
    filterBlockedAuthors<T extends { authorId?: string; userId?: string; id?: string }>(
      items: T[],
      idKey: "authorId" | "userId" | "id" = "authorId"
    ): T[] {
      const blocked = new Set([...getCtx().blockedUsers, ...(getCtx().restrictedUsers || [])])
      return items.filter((item) => {
        const id = (item as any)[idKey] as string | undefined
        if (!id) return true
        return !blocked.has(id)
      })
    },

    canFollow(userId: string) {
      return canFollow(getCtx(), userId)
    },

    canConnect(userId: string) {
      return canConnect(getCtx(), userId)
    },

    canMatch(userId: string) {
      return canMatch(getCtx(), userId)
    },

    canMessage(userId: string) {
      return canMessageUser(getCtx(), userId)
    },

    canBlock(userId: string) {
      return canBlock(getCtx(), userId)
    },

    // ── Mutations ─────────────────────────────────────────────────────

    async toggleFollow(
      userId: string
    ): Promise<MutationResult<{ following: string[]; action: "follow" | "unfollow" }>> {
      const s = getCtx()
      const already = s.following.includes(userId)
      const action: GraphTransition = already ? "unfollow" : "follow"
      return runMutation({
        name: "graph.toggleFollow",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, action),
        authorize: (i) => {
          if (action === "follow" && !canFollow(s, i.userId)) return "Follow not allowed"
          return null
        },
        mutate: (i) => {
          const following = already
            ? s.following.filter((id) => id !== i.userId)
            : [...s.following, i.userId]
          if (already) socialGraphStore.removeEdge(s.currentUserId, i.userId, "follow")
          else socialGraphStore.addEdge(s.currentUserId, i.userId, "follow")
          persistEdge(s, already ? "unfollow" : "follow", i.userId)
          return { following, action: (already ? "unfollow" : "follow") as "follow" | "unfollow" }
        },
        eventType: already ? "FOLLOW_REMOVED" : "FOLLOW_CREATED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async sendFriendRequest(
      userId: string
    ): Promise<MutationResult<{ outgoingFriendRequestIds: string[]; friends: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.sendFriendRequest",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "send_connection_request"),
        authorize: (i) => (canConnect(s, i.userId) ? null : "Connection not allowed"),
        mutate: (i) => {
          const outgoing = Array.from(new Set([...(s.outgoingFriendRequestIds || []), i.userId]))
          socialGraphStore.addEdge(s.currentUserId, i.userId, "friend_request")
          persistEdge(s, "friend_request", i.userId)
          return { outgoingFriendRequestIds: outgoing, friends: s.friends || [] }
        },
        eventType: "FRIEND_REQUEST_SENT",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async cancelFriendRequest(
      userId: string
    ): Promise<MutationResult<{ outgoingFriendRequestIds: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.cancelFriendRequest",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "cancel_request"),
        mutate: (i) => {
          socialGraphStore.removeEdge(s.currentUserId, i.userId, "friend_request")
          const outgoing = (s.outgoingFriendRequestIds || []).filter((id) => id !== i.userId)
          return { outgoingFriendRequestIds: outgoing }
        },
        eventType: "FRIEND_REQUEST_CANCELLED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async acceptFriendRequest(
      userId: string
    ): Promise<MutationResult<{ friends: string[]; incomingFriendRequestIds: string[]; following: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.acceptFriendRequest",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "accept_request"),
        mutate: (i) => {
          socialGraphStore.clearFriendRequestsBetween(s.currentUserId, i.userId)
          socialGraphStore.addEdge(s.currentUserId, i.userId, "friend")
          socialGraphStore.addEdge(i.userId, s.currentUserId, "friend")
          if (!s.following.includes(i.userId)) {
            socialGraphStore.addEdge(s.currentUserId, i.userId, "follow")
          }
          const friends = Array.from(new Set([...(s.friends || []), i.userId]))
          const following = Array.from(new Set([...(s.following || []), i.userId]))
          const incomingFriendRequestIds = (s.incomingFriendRequestIds || []).filter((id) => id !== i.userId)
          return { friends, incomingFriendRequestIds, following }
        },
        eventType: "FRIEND_ACCEPTED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async rejectFriendRequest(
      userId: string
    ): Promise<MutationResult<{ incomingFriendRequestIds: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.rejectFriendRequest",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "reject_request"),
        mutate: (i) => {
          socialGraphStore.clearFriendRequestsBetween(s.currentUserId, i.userId)
          return {
            incomingFriendRequestIds: (s.incomingFriendRequestIds || []).filter((id) => id !== i.userId),
          }
        },
        eventType: "FRIEND_REQUEST_REJECTED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async removeFriend(userId: string): Promise<MutationResult<{ friends: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.removeFriend",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "remove_connection"),
        mutate: (i) => {
          socialGraphStore.removeEdge(s.currentUserId, i.userId, "friend")
          socialGraphStore.removeEdge(i.userId, s.currentUserId, "friend")
          return { friends: (s.friends || []).filter((id) => id !== i.userId) }
        },
        eventType: "FRIEND_REMOVED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async addMatch(userId: string): Promise<MutationResult<{ matchIds: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.addMatch",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "match"),
        authorize: (i) => (canMatch(s, i.userId) ? null : "Match not allowed"),
        mutate: (i) => {
          socialGraphStore.addEdge(s.currentUserId, i.userId, "match")
          const matchIds = Array.from(new Set([...(s.matches || []).map((m) => m.userId), i.userId]))
          persistEdge(s, "match", i.userId)
          return { matchIds }
        },
        eventType: "MATCH_CREATED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async removeMatch(userId: string): Promise<MutationResult<{ matchIds: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.removeMatch",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "unmatch"),
        mutate: (i) => {
          socialGraphStore.removeEdge(s.currentUserId, i.userId, "match")
          persistEdge(s, "unmatch", i.userId)
          return { matchIds: (s.matches || []).map((m) => m.userId).filter((id) => id !== i.userId) }
        },
        eventType: "MATCH_REMOVED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async applyBlock(userId: string): Promise<MutationResult<Record<string, unknown>>> {
      const s = getCtx()
      return runMutation({
        name: "graph.block",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "block"),
        authorize: (i) => (canBlock(s, i.userId) ? null : "Cannot block this user"),
        mutate: (i) => {
          const clears = blockClearsContradictions(i.userId)
          const effects = applyBlockEffects({
            userId: i.userId,
            blockedUsers: s.blockedUsers,
            candidates: s.candidates,
            matches: s.matches as any,
            conversations: s.conversations,
            followingIds: s.following,
          })
          socialGraphStore.addEdge(s.currentUserId, i.userId, "block")
          if (clears.removeFollow) socialGraphStore.removeEdge(s.currentUserId, i.userId, "follow")
          if (clears.removeFriend) {
            socialGraphStore.removeEdge(s.currentUserId, i.userId, "friend")
            socialGraphStore.removeEdge(i.userId, s.currentUserId, "friend")
          }
          if (clears.removeMatch) socialGraphStore.removeEdge(s.currentUserId, i.userId, "match")
          if (clears.clearRequests) socialGraphStore.clearFriendRequestsBetween(s.currentUserId, i.userId)
          if (clears.removeMute) socialGraphStore.removeEdge(s.currentUserId, i.userId, "mute")
          if (clears.removeRestrict) socialGraphStore.removeEdge(s.currentUserId, i.userId, "restrict")
          const friends = (s.friends || []).filter((id) => id !== i.userId)
          const mutedUsers = (s.mutedUsers || []).filter((id) => id !== i.userId)
          const restrictedUsers = (s.restrictedUsers || []).filter((id) => id !== i.userId)
          const outgoingFriendRequestIds = (s.outgoingFriendRequestIds || []).filter((id) => id !== i.userId)
          const incomingFriendRequestIds = (s.incomingFriendRequestIds || []).filter((id) => id !== i.userId)
          persistEdge(s, "block", i.userId)
          return {
            ok: true,
            ...effects,
            friends,
            mutedUsers,
            restrictedUsers,
            outgoingFriendRequestIds,
            incomingFriendRequestIds,
          }
        },
        eventType: "BLOCK_CREATED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async removeBlock(userId: string): Promise<MutationResult<{ blockedUsers: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.unblock",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "unblock"),
        mutate: (i) => {
          socialGraphStore.removeEdge(s.currentUserId, i.userId, "block")
          persistEdge(s, "unblock", i.userId)
          return { blockedUsers: (s.blockedUsers || []).filter((id) => id !== i.userId) }
        },
        eventType: "BLOCK_REMOVED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async muteUser(userId: string): Promise<MutationResult<{ mutedUsers: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.mute",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "mute"),
        mutate: (i) => {
          socialGraphStore.addEdge(s.currentUserId, i.userId, "mute")
          return { mutedUsers: Array.from(new Set([...(s.mutedUsers || []), i.userId])) }
        },
        eventType: "MUTE_CREATED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async unmuteUser(userId: string): Promise<MutationResult<{ mutedUsers: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.unmute",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "unmute"),
        mutate: (i) => {
          socialGraphStore.removeEdge(s.currentUserId, i.userId, "mute")
          return { mutedUsers: (s.mutedUsers || []).filter((id) => id !== i.userId) }
        },
        eventType: "MUTE_REMOVED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async restrictUser(userId: string): Promise<MutationResult<{ restrictedUsers: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.restrict",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "restrict"),
        mutate: (i) => {
          socialGraphStore.addEdge(s.currentUserId, i.userId, "restrict")
          return { restrictedUsers: Array.from(new Set([...(s.restrictedUsers || []), i.userId])) }
        },
        eventType: "RESTRICT_CREATED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    async unrestrictUser(userId: string): Promise<MutationResult<{ restrictedUsers: string[] }>> {
      const s = getCtx()
      return runMutation({
        name: "graph.unrestrict",
        actorId: s.currentUserId,
        input: { userId },
        validate: (i) => transitionGate(s, i.userId, "unrestrict"),
        mutate: (i) => {
          socialGraphStore.removeEdge(s.currentUserId, i.userId, "restrict")
          return { restrictedUsers: (s.restrictedUsers || []).filter((id) => id !== i.userId) }
        },
        eventType: "RESTRICT_REMOVED",
        eventPayload: (_d, i) => ({ userId: i.userId }),
      })
    },

    /** Pre-flight: can this transition run without writing? */
    canTransition(userId: string, action: GraphTransition): string | null {
      return transitionGate(getCtx(), userId, action)
    },
  }
}

export type SocialGraphDomain = ReturnType<typeof createSocialGraphDomain>
