/** Pure adapters from the legacy GHC session cache into domain read contracts. */

export type SessionFeedPost = {
  id?: unknown
  authorId?: unknown
  authorName?: unknown
  content?: unknown
  createdAt?: unknown
  likes?: unknown
  comments?: unknown
  isDraft?: unknown
  isScheduled?: unknown
}

export type SessionCandidate = {
  id?: unknown
  name?: unknown
  location?: unknown
  city?: unknown
  bio?: unknown
  photo?: unknown
  interests?: unknown
  profession?: unknown
  relationshipGoals?: unknown
  primaryMode?: unknown
  isSample?: unknown
}

export type SessionFriendRequest = {
  fromUserId?: unknown
  toUserId?: unknown
}

function finiteCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0
}

function isoTimestamp(value: unknown): string {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Date.parse(value)
      : Number.NaN
  return Number.isFinite(parsed) && parsed > 0
    ? new Date(parsed).toISOString()
    : new Date(0).toISOString()
}

export function mapSessionFeedPosts(posts: readonly SessionFeedPost[]) {
  return posts.flatMap((post) => {
    const id = typeof post.id === "string" ? post.id.trim() : ""
    if (!id || post.isDraft === true || post.isScheduled === true) return []
    const comments = Array.isArray(post.comments) ? post.comments : []
    return [{
      id,
      authorId: typeof post.authorId === "string" ? post.authorId : "",
      authorName: typeof post.authorName === "string" && post.authorName.trim() ? post.authorName : "Member",
      content: typeof post.content === "string" ? post.content : "",
      createdAt: isoTimestamp(post.createdAt),
      likes: finiteCount(post.likes),
      comments,
      commentCount: comments.length,
    }]
  })
}

/** Production discovery only accepts candidates explicitly marked server-hydrated. */
export function mapSessionDiscoveryCandidates(candidates: readonly SessionCandidate[], allowDemo: boolean) {
  return candidates.flatMap((candidate) => {
    const id = typeof candidate.id === "string" ? candidate.id.trim() : ""
    if (!id || (!allowDemo && candidate.isSample !== false)) return []
    return [{
      id,
      name: typeof candidate.name === "string" ? candidate.name : "Member",
      displayName: typeof candidate.name === "string" ? candidate.name : "Member",
      location: typeof candidate.location === "string" ? candidate.location : "",
      city: typeof candidate.city === "string" ? candidate.city : "",
      bio: typeof candidate.bio === "string" ? candidate.bio : "",
      photo: typeof candidate.photo === "string" ? candidate.photo : "",
      avatar: typeof candidate.photo === "string" ? candidate.photo : "",
      interests: Array.isArray(candidate.interests) ? candidate.interests.filter((v): v is string => typeof v === "string") : [],
      profession: typeof candidate.profession === "string" ? candidate.profession : "",
      connectionIntents: Array.isArray(candidate.relationshipGoals) ? candidate.relationshipGoals.filter((v): v is string => typeof v === "string") : [],
      primaryMode: typeof candidate.primaryMode === "string" ? candidate.primaryMode : undefined,
      isSample: candidate.isSample,
    }]
  })
}

export function summarizeSessionConnections(input: {
  friends: readonly unknown[]
  following: readonly unknown[]
  followers: readonly unknown[]
  friendRequests: readonly SessionFriendRequest[]
  currentUserId: string
}) {
  const currentUserId = input.currentUserId.trim()
  const pendingRequestsCount = currentUserId
    ? input.friendRequests.filter((request) => {
        const from = typeof request.fromUserId === "string" ? request.fromUserId : ""
        const to = typeof request.toUserId === "string" ? request.toUserId : ""
        return from !== currentUserId && (to === currentUserId || !to)
      }).length
    : 0
  return {
    friendsCount: input.friends.length,
    followingCount: input.following.length,
    followersCount: input.followers.length,
    pendingRequestsCount,
  }
}
