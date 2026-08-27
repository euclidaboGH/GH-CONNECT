/**
 * Social graph relations — canonical vocabulary for GH Connect.
 *
 * Follow           = one-directional (A → B)
 * Follower         = inverse of follow (B sees A as follower)
 * Friend           = two-directional connection after accept
 * Friend request   = pending connection invite
 * Match            = dating/match product edge (may also message)
 * Mutual follow    = both follow each other (not necessarily friends)
 * FoF              = friend-of-friend (discoverable with privacy gates)
 *
 * Orthogonal suppressors (always checked first):
 *   Block | Mute | Restrict
 */

export type RelationKind =
  | "none"
  | "following"
  | "follower"
  | "mutual"
  | "friends"
  | "match"
  | "friend_request_sent"
  | "friend_request_received"
  | "blocked"
  | "muted"
  | "restricted"

export interface SocialEdge {
  fromUserId: string
  toUserId: string
  kind: "follow" | "friend_request" | "friend" | "match" | "block" | "mute" | "restrict"
  createdAt: number
}

export interface RelationSnapshotInput {
  followingIds: string[]
  followerIds: string[]
  friendIds: string[]
  matchIds: string[]
  blockedIds: string[]
  mutedIds?: string[]
  restrictedIds?: string[]
  outgoingRequestIds?: string[]
  incomingRequestIds?: string[]
}

/** Full relation kind between me and another user (priority: block > restrict > mute > friend > match > requests > follow) */
export function relationBetween(
  me: string,
  other: string,
  followingIds: string[],
  followerIds: string[],
  friendIds: string[],
  blockedIds: string[],
  extras?: {
    matchIds?: string[]
    mutedIds?: string[]
    restrictedIds?: string[]
    outgoingRequestIds?: string[]
    incomingRequestIds?: string[]
  }
): RelationKind {
  if (!other || other === me) return "none"
  if (blockedIds.includes(other)) return "blocked"
  if ((extras?.restrictedIds || []).includes(other)) return "restricted"
  if ((extras?.mutedIds || []).includes(other)) return "muted"
  if (friendIds.includes(other)) return "friends"
  if ((extras?.matchIds || []).includes(other)) return "match"
  if ((extras?.outgoingRequestIds || []).includes(other)) return "friend_request_sent"
  if ((extras?.incomingRequestIds || []).includes(other)) return "friend_request_received"
  const follows = followingIds.includes(other)
  const followedBy = followerIds.includes(other)
  if (follows && followedBy) return "mutual"
  if (follows) return "following"
  if (followedBy) return "follower"
  return "none"
}

/** Overload-friendly helper from a structured snapshot */
export function relationFromSnapshot(
  me: string,
  other: string,
  snap: RelationSnapshotInput
): RelationKind {
  return relationBetween(me, other, snap.followingIds, snap.followerIds, snap.friendIds, snap.blockedIds, {
    matchIds: snap.matchIds,
    mutedIds: snap.mutedIds,
    restrictedIds: snap.restrictedIds,
    outgoingRequestIds: snap.outgoingRequestIds,
    incomingRequestIds: snap.incomingRequestIds,
  })
}

export function friendsOfFriends(
  myFriendIds: string[],
  friendsByUser: Record<string, string[]>,
  excludeIds: Set<string>
): string[] {
  const out = new Set<string>()
  for (const f of myFriendIds) {
    for (const fof of friendsByUser[f] || []) {
      if (!excludeIds.has(fof) && fof !== f) out.add(fof)
    }
  }
  return [...out]
}

/** Primary profile CTA based on relation */
export function profilePrimaryAction(
  kind: RelationKind
): "follow" | "following" | "friends" | "message" | "blocked" | "accept_request" | "requested" | "match" {
  switch (kind) {
    case "blocked":
      return "blocked"
    case "friends":
      return "friends"
    case "match":
      return "match"
    case "friend_request_received":
      return "accept_request"
    case "friend_request_sent":
      return "requested"
    case "following":
    case "mutual":
      return "following"
    default:
      return "follow"
  }
}
