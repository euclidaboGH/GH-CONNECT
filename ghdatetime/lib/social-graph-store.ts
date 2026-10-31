/**
 * Social graph store — local edge persistence until backend is authoritative.
 * Owned by Social Graph domain; do not treat this as a second mutation API.
 *
 * Edge types:
 *   follow | friend | friend_request | block | mute | restrict | match
 */

export type EdgeType =
  | "follow"
  | "friend"
  | "friend_request"
  | "block"
  | "mute"
  | "restrict"
  | "match"

export interface GraphEdge {
  fromUserId: string
  toUserId: string
  type: EdgeType
  createdAt: number
  /** Optional metadata (e.g. request message, restrict scope) */
  meta?: Record<string, unknown>
}

const KEY = "ghc_social_graph_v1"

function read(): GraphEdge[] {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(edges: GraphEdge[]) {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(KEY, JSON.stringify(edges.slice(-8000)))
  } catch {
    /* quota */
  }
}

function idsOf(me: string, type: EdgeType, direction: "out" | "in" = "out"): string[] {
  return read()
    .filter((e) =>
      direction === "out"
        ? e.fromUserId === me && e.type === type
        : e.toUserId === me && e.type === type
    )
    .map((e) => (direction === "out" ? e.toUserId : e.fromUserId))
}

export const socialGraphStore = {
  list(): GraphEdge[] {
    return read()
  },

  followingIds(me: string): string[] {
    return idsOf(me, "follow", "out")
  },

  followerIds(me: string): string[] {
    return idsOf(me, "follow", "in")
  },

  friendIds(me: string): string[] {
    return idsOf(me, "friend", "out")
  },

  /** Incoming friend requests (others → me) */
  incomingFriendRequestIds(me: string): string[] {
    return idsOf(me, "friend_request", "in")
  },

  /** Outgoing friend requests (me → others) */
  outgoingFriendRequestIds(me: string): string[] {
    return idsOf(me, "friend_request", "out")
  },

  blockedIds(me: string): string[] {
    return idsOf(me, "block", "out")
  },

  mutedIds(me: string): string[] {
    return idsOf(me, "mute", "out")
  },

  restrictedIds(me: string): string[] {
    return idsOf(me, "restrict", "out")
  },

  matchIds(me: string): string[] {
    return idsOf(me, "match", "out")
  },

  hasEdge(fromUserId: string, toUserId: string, type: EdgeType): boolean {
    return read().some(
      (e) => e.fromUserId === fromUserId && e.toUserId === toUserId && e.type === type
    )
  },

  addEdge(
    fromUserId: string,
    toUserId: string,
    type: EdgeType,
    meta?: Record<string, unknown>
  ): void {
    let edges = read().filter(
      (e) => !(e.fromUserId === fromUserId && e.toUserId === toUserId && e.type === type)
    )
    edges.push({ fromUserId, toUserId, type, createdAt: Date.now(), meta })

    // Block supersedes social edges both directions
    if (type === "block") {
      edges = edges.filter(
        (e) =>
          !(
            (e.fromUserId === fromUserId &&
              e.toUserId === toUserId &&
              (e.type === "follow" ||
                e.type === "friend" ||
                e.type === "friend_request" ||
                e.type === "match")) ||
            (e.fromUserId === toUserId &&
              e.toUserId === fromUserId &&
              (e.type === "follow" ||
                e.type === "friend" ||
                e.type === "friend_request" ||
                e.type === "match"))
          )
      )
    }

    write(edges)
  },

  removeEdge(fromUserId: string, toUserId: string, type: EdgeType): void {
    write(
      read().filter(
        (e) => !(e.fromUserId === fromUserId && e.toUserId === toUserId && e.type === type)
      )
    )
  },

  /** Remove friend_request edges in either direction between two users */
  clearFriendRequestsBetween(a: string, b: string): void {
    write(
      read().filter(
        (e) =>
          !(
            e.type === "friend_request" &&
            ((e.fromUserId === a && e.toUserId === b) || (e.fromUserId === b && e.toUserId === a))
          )
      )
    )
  },

  /**
   * Sync React session arrays into the store (idempotent for me’s outbound edges).
   * Does not wipe inbound edges from other users.
   */
  syncFromState(
    me: string,
    following: string[],
    friends: string[],
    blocked: string[],
    muted: string[] = [],
    restricted: string[] = [],
    matchIds: string[] = []
  ): void {
    const others = read().filter((e) => e.fromUserId !== me)
    const next: GraphEdge[] = [...others]
    const now = Date.now()
    for (const id of following) next.push({ fromUserId: me, toUserId: id, type: "follow", createdAt: now })
    for (const id of friends) next.push({ fromUserId: me, toUserId: id, type: "friend", createdAt: now })
    for (const id of blocked) next.push({ fromUserId: me, toUserId: id, type: "block", createdAt: now })
    for (const id of muted) next.push({ fromUserId: me, toUserId: id, type: "mute", createdAt: now })
    for (const id of restricted) next.push({ fromUserId: me, toUserId: id, type: "restrict", createdAt: now })
    for (const id of matchIds) next.push({ fromUserId: me, toUserId: id, type: "match", createdAt: now })
    write(next)
  },
}
