/**
 * Social Graph session compatibility adapter.
 *
 * Domain owns relationship *operations* and edge persistence.
 * GHCContext still holds React session arrays for Feed / Find / Matches /
 * Messages / Profile consumers. This adapter is the only place that maps
 * domain mutation results → session slice patches.
 *
 * Do not invent a second graph — only translate domain data into state.
 */

import type { FriendRequest, MatchEntry } from "../ghc-types"
import { socialGraphStore } from "../social-graph-store"
import type { SocialGraphSnapshot } from "../social-graph"

/** Relationship fields that live on session state (compat cache) */
export interface GraphSessionSlice {
  following: string[]
  followers: string[]
  friends: string[]
  friendRequests: FriendRequest[]
  matches: MatchEntry[]
  blockedUsers: string[]
  mutedUsers: string[]
  restrictedUsers: string[]
}

export function emptyGraphSessionSlice(): GraphSessionSlice {
  return {
    following: [],
    followers: [],
    friends: [],
    friendRequests: [],
    matches: [],
    blockedUsers: [],
    mutedUsers: [],
    restrictedUsers: [],
  }
}

/** Project domain snapshot + optional request objects into a session slice */
export function sessionSliceFromSnapshot(
  snap: SocialGraphSnapshot,
  previous: Partial<GraphSessionSlice> = {}
): GraphSessionSlice {
  return {
    following: [...(snap.followingIds || [])],
    followers: [...(snap.followersIds || [])],
    friends: [...(snap.friendIds || [])],
    friendRequests: previous.friendRequests || [],
    matches: previous.matches || [],
    blockedUsers: [...(snap.blockedUsers || [])],
    mutedUsers: [...(snap.mutedIds || [])],
    restrictedUsers: [...(snap.restrictedIds || [])],
  }
}

/** Persist outbound edges from session arrays into the graph store */
export function syncSessionEdgesToStore(
  me: string,
  slice: Pick<
    GraphSessionSlice,
    "following" | "friends" | "blockedUsers" | "mutedUsers" | "restrictedUsers" | "matches"
  >
): void {
  socialGraphStore.syncFromState(
    me,
    slice.following || [],
    slice.friends || [],
    slice.blockedUsers || [],
    slice.mutedUsers || [],
    slice.restrictedUsers || [],
    (slice.matches || []).map((m) => m.userId)
  )
}

// ── Mutation result → partial session patches ─────────────────────────────

export function patchFromFollow(data: {
  following: string[]
  action: "follow" | "unfollow"
}): Partial<GraphSessionSlice> {
  return { following: data.following }
}

export function patchFromFriendRequestSent(
  data: { outgoingFriendRequestIds: string[] },
  previousRequests: FriendRequest[],
  newRequest: FriendRequest
): Partial<GraphSessionSlice> {
  const filtered = previousRequests.filter(
    (r) => !(r.fromUserId === "current-user" && (r as any).toUserId === (newRequest as any).toUserId)
  )
  return { friendRequests: [...filtered, newRequest] }
}

export function patchFromFriendRemoved(data: { friends: string[] }): Partial<GraphSessionSlice> {
  return { friends: data.friends }
}

export function patchFromFriendAccepted(data: {
  friends: string[]
  incomingFriendRequestIds: string[]
  following: string[]
}): Partial<GraphSessionSlice> & { incomingFriendRequestIds: string[] } {
  return {
    friends: data.friends,
    following: data.following,
    incomingFriendRequestIds: data.incomingFriendRequestIds,
  }
}

export function patchFromBlock(data: {
  blockedUsers?: string[]
  followingIds?: string[]
  friends?: string[]
  matches?: MatchEntry[]
  mutedUsers?: string[]
  restrictedUsers?: string[]
  outgoingFriendRequestIds?: string[]
  incomingFriendRequestIds?: string[]
  candidates?: { id: string }[]
  conversations?: unknown[]
}): Partial<GraphSessionSlice> & {
  candidates?: { id: string }[]
  conversations?: unknown[]
  settingsBlockedUsers?: string[]
} {
  return {
    blockedUsers: data.blockedUsers,
    following: data.followingIds,
    friends: data.friends,
    matches: data.matches,
    mutedUsers: data.mutedUsers,
    restrictedUsers: data.restrictedUsers,
    candidates: data.candidates,
    conversations: data.conversations,
    settingsBlockedUsers: data.blockedUsers,
  }
}

export function patchFromUnblock(data: { blockedUsers: string[] }): Partial<GraphSessionSlice> & {
  settingsBlockedUsers: string[]
} {
  return { blockedUsers: data.blockedUsers, settingsBlockedUsers: data.blockedUsers }
}

export function patchFromMute(data: { mutedUsers: string[] }): Partial<GraphSessionSlice> {
  return { mutedUsers: data.mutedUsers }
}

export function patchFromRestrict(data: { restrictedUsers: string[] }): Partial<GraphSessionSlice> {
  return { restrictedUsers: data.restrictedUsers }
}

export function patchFromMatchIds(
  matchIds: string[],
  previous: MatchEntry[],
  ensureEntry?: (userId: string) => MatchEntry
): Partial<GraphSessionSlice> {
  const byId = new Map(previous.map((m) => [m.userId, m]))
  const next: MatchEntry[] = []
  for (const id of matchIds) {
    const existing = byId.get(id)
    if (existing) next.push(existing)
    else if (ensureEntry) next.push(ensureEntry(id))
    else
      next.push({
        id: `match-${id}`,
        userId: id,
        userName: "Match",
        userPhoto: "/placeholder.svg?width=40&height=40",
        matchedAt: Date.now(),
        online: false,
      })
  }
  return { matches: next }
}

/**
 * Merge a graph patch into a full session object (immutable).
 * Safe for setState(s => applyGraphPatch(s, patch)).
 */
export function applyGraphPatch<T extends Record<string, unknown>>(
  state: T,
  patch: Partial<GraphSessionSlice> & {
    candidates?: unknown
    conversations?: unknown
    settingsBlockedUsers?: string[]
  }
): T {
  const next: any = { ...state }
  if (patch.following) next.following = patch.following
  if (patch.followers) next.followers = patch.followers
  if (patch.friends) next.friends = patch.friends
  if (patch.friendRequests) next.friendRequests = patch.friendRequests
  if (patch.matches) next.matches = patch.matches
  if (patch.blockedUsers) {
    next.blockedUsers = patch.blockedUsers
  }
  if (patch.mutedUsers) {
    next.mutedUsers = patch.mutedUsers
    next.settings = {
      ...(next.settings || {}),
      mutedUsers: patch.mutedUsers,
    }
  }
  if (patch.restrictedUsers) {
    next.restrictedUsers = patch.restrictedUsers
    next.settings = {
      ...(next.settings || {}),
      restrictedUsers: patch.restrictedUsers,
    }
  }
  if (patch.settingsBlockedUsers) {
    next.settings = {
      ...(next.settings || {}),
      blockedUsers: patch.settingsBlockedUsers,
    }
  }
  if (patch.candidates) next.candidates = patch.candidates
  if (patch.conversations) next.conversations = patch.conversations
  return next as T
}
