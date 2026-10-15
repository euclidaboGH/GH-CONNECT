/**
 * Client helpers for durable social APIs.
 * Optimistic UI remains in domain/context; these calls make server authoritative.
 */
import { IdentityService } from "@/lib/identity/identity-service"
import type { Post, PostComment, StoryItem } from "@/lib/ghc-types"

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...IdentityService.getAuthHeaders(),
  }
}

async function json<T>(
  path: string,
  init?: RequestInit
): Promise<T & { ok?: boolean; error?: string; durable?: boolean }> {
  const res = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  })
  const data = (await res.json().catch(() => ({}))) as T & {
    ok?: boolean
    error?: string
    durable?: boolean
  }
  if (!res.ok && data.ok !== true) {
    return { ...data, ok: false, error: data.error || `HTTP_${res.status}` }
  }
  return data
}

export async function socialFetchFeed(opts?: {
  limit?: number
  before?: number
}): Promise<{ ok: boolean; durable: boolean; posts: Partial<Post>[]; error?: string }> {
  const q = new URLSearchParams()
  if (opts?.limit) q.set("limit", String(opts.limit))
  if (opts?.before) q.set("before", String(opts.before))
  const path = `/api/social/feed${q.toString() ? `?${q}` : ""}`
  const data = await json<{ posts?: Partial<Post>[] }>(path)
  return {
    ok: data.ok !== false,
    durable: Boolean(data.durable),
    posts: Array.isArray(data.posts) ? data.posts : [],
    error: data.error,
  }
}

export async function socialCreatePost(
  post: Partial<Post> & { content: string }
): Promise<{ ok: boolean; durable: boolean; post?: Partial<Post>; error?: string }> {
  return json("/api/social/posts", {
    method: "POST",
    body: JSON.stringify(post),
  })
}

export async function socialDeletePost(
  postId: string
): Promise<{ ok: boolean; durable: boolean; error?: string }> {
  return json(`/api/social/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
  })
}

export async function socialToggleReaction(
  postId: string,
  reaction: string = "like"
): Promise<{
  ok: boolean
  durable: boolean
  reaction?: string
  active?: boolean
  liked?: boolean
  likeCount?: number | null
  error?: string
}> {
  return json(`/api/social/posts/${encodeURIComponent(postId)}/reactions`, {
    method: "POST",
    body: JSON.stringify({ reaction: reaction || "like" }),
  })
}

/** @deprecated Prefer socialToggleReaction(postId, "like") */
export async function socialToggleLike(
  postId: string
): Promise<{
  ok: boolean
  durable: boolean
  liked?: boolean
  likeCount?: number | null
  error?: string
}> {
  return socialToggleReaction(postId, "like")
}

export async function socialAddComment(
  postId: string,
  input: { text: string; authorName?: string; authorPhoto?: string; parentId?: string; id?: string }
): Promise<{ ok: boolean; durable: boolean; comment?: Partial<PostComment>; error?: string }> {
  return json(`/api/social/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function socialListComments(
  postId: string
): Promise<{ ok: boolean; durable: boolean; comments: Partial<PostComment>[] }> {
  const data = await json<{ comments?: Partial<PostComment>[] }>(
    `/api/social/posts/${encodeURIComponent(postId)}/comments`
  )
  return {
    ok: data.ok !== false,
    durable: Boolean(data.durable),
    comments: Array.isArray(data.comments) ? data.comments : [],
  }
}

export async function socialFollow(
  targetUserId: string,
  follow: boolean
): Promise<{ ok: boolean; durable: boolean; following?: boolean; error?: string }> {
  return json("/api/social/follows", {
    method: "POST",
    body: JSON.stringify({ targetUserId, follow }),
  })
}

export async function socialFetchFollows(): Promise<{
  ok: boolean
  durable: boolean
  following: string[]
  followers: string[]
  followingCount: number
  followersCount: number
}> {
  const data = await json<{
    following?: string[]
    followers?: string[]
    followingCount?: number
    followersCount?: number
  }>("/api/social/follows")
  const following = Array.isArray(data.following) ? data.following : []
  const followers = Array.isArray(data.followers) ? data.followers : []
  return {
    ok: data.ok !== false,
    durable: Boolean(data.durable),
    following,
    followers,
    followingCount: Number(data.followingCount) || following.length,
    followersCount: Number(data.followersCount) || followers.length,
  }
}

/** Authoritative relationship + counts for a target profile. */
export async function socialFetchFollowStatus(targetUserId: string): Promise<{
  ok: boolean
  durable: boolean
  isFollowing: boolean
  blocked: boolean
  followersCount: number
  followingCount: number
  error?: string
}> {
  const id = String(targetUserId || "").trim()
  if (!id) {
    return {
      ok: false,
      durable: false,
      isFollowing: false,
      blocked: false,
      followersCount: 0,
      followingCount: 0,
      error: "TARGET_REQUIRED",
    }
  }
  const data = await json<{
    isFollowing?: boolean
    blocked?: boolean
    followersCount?: number
    followingCount?: number
    error?: string
    durable?: boolean
  }>(`/api/social/follows?targetUserId=${encodeURIComponent(id)}`)
  return {
    ok: data.ok !== false,
    durable: Boolean(data.durable),
    isFollowing: Boolean(data.isFollowing),
    blocked: Boolean(data.blocked),
    followersCount: Number(data.followersCount) || 0,
    followingCount: Number(data.followingCount) || 0,
    error: data.error,
  }
}

export async function socialBlock(
  targetUserId: string,
  block: boolean
): Promise<{ ok: boolean; durable: boolean; blocked?: boolean; error?: string }> {
  return json("/api/social/blocks", {
    method: "POST",
    body: JSON.stringify({ targetUserId, block }),
  })
}

export async function socialMute(
  targetUserId: string,
  mute: boolean
): Promise<{ ok: boolean; durable: boolean; muted?: boolean; error?: string }> {
  return json("/api/social/mutes", {
    method: "POST",
    body: JSON.stringify({ targetUserId, mute }),
  })
}

export async function socialReport(input: {
  targetType: string
  targetId: string
  reason: string
  details?: string
}): Promise<{ ok: boolean; durable?: boolean; error?: string }> {
  return json("/api/reports", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function socialCreateStory(
  story: Partial<StoryItem>
): Promise<{ ok: boolean; durable: boolean; story?: Partial<StoryItem>; error?: string }> {
  return json("/api/social/stories", {
    method: "POST",
    body: JSON.stringify(story),
  })
}

export async function socialFetchStories(): Promise<{
  ok: boolean
  durable: boolean
  stories: Partial<StoryItem>[]
}> {
  const data = await json<{ stories?: Partial<StoryItem>[] }>("/api/social/stories")
  return {
    ok: data.ok !== false,
    durable: Boolean(data.durable),
    stories: Array.isArray(data.stories) ? data.stories : [],
  }
}

export async function socialViewStory(
  storyId: string
): Promise<{ ok: boolean; durable: boolean; error?: string }> {
  return json(`/api/social/stories/${encodeURIComponent(storyId)}/view`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

export async function socialToggleSave(
  postId: string
): Promise<{ ok: boolean; durable: boolean; saved?: boolean; error?: string }> {
  return json("/api/social/saves", {
    method: "POST",
    body: JSON.stringify({ postId }),
  })
}

/** Durable share edge — does not copy content; server increments share_count. */
export async function socialSharePost(
  postId: string
): Promise<{ ok: boolean; durable: boolean; shareCount?: number | null; error?: string }> {
  const id = String(postId || "").trim()
  if (!id) return { ok: false, durable: false, error: "POST_REQUIRED" }
  return json(`/api/social/posts/${encodeURIComponent(id)}/share`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

/**
 * Fail-soft attention ping. Never throws to callers; no economy side effects.
 */
export async function socialRecordAttention(
  postId: string,
  eventType: "view" | "qualified_view" | "complete" | "save" | "share",
  opts?: { dwellMs?: number }
): Promise<void> {
  const id = String(postId || "").trim()
  if (!id) return
  try {
    await json(`/api/social/posts/${encodeURIComponent(id)}/attention`, {
      method: "POST",
      body: JSON.stringify({
        eventType,
        ...(opts?.dwellMs != null ? { dwellMs: opts.dwellMs } : {}),
      }),
    })
  } catch {
    /* feed must keep working */
  }
}

/** Server attention/engagement aggregates (author or public post). Fail-soft. */
export async function socialFetchPostInsights(postId: string): Promise<{
  ok: boolean
  durable?: boolean
  metrics?: Record<string, number> | null
  isAuthor?: boolean
  error?: string
  reason?: string
}> {
  const id = String(postId || "").trim()
  if (!id) return { ok: false, error: "INVALID_ID" }
  try {
    return await json(`/api/social/posts/${encodeURIComponent(id)}/insights`, {
      method: "GET",
    })
  } catch {
    return { ok: true, durable: false, metrics: null, reason: "NETWORK" }
  }
}


export async function socialConnectionRequest(input: {
  toUserId: string
  intents?: string[]
  note?: string
  source?: string
}): Promise<{ ok: boolean; durable?: boolean; error?: string }> {
  return json("/api/connections/request", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function socialConnectionAccept(
  fromUserId: string
): Promise<{ ok: boolean; durable?: boolean; error?: string }> {
  return json("/api/connections/accept", {
    method: "POST",
    body: JSON.stringify({ fromUserId }),
  })
}

export async function socialConnectionDecline(
  fromUserId: string
): Promise<{ ok: boolean; durable?: boolean; error?: string }> {
  return json("/api/connections/decline", {
    method: "POST",
    body: JSON.stringify({ fromUserId }),
  })
}


export async function socialEditPost(
  postId: string,
  content: string
): Promise<{ ok: boolean; durable: boolean; error?: string }> {
  return json(`/api/social/posts/${encodeURIComponent(postId)}/edit`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  })
}

export async function socialDeleteComment(
  postId: string,
  commentId: string
): Promise<{ ok: boolean; durable: boolean; error?: string }> {
  return json(
    `/api/social/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" }
  )
}

export async function socialListCommunities(limit = 50): Promise<{
  ok: boolean
  durable: boolean
  communities: unknown[]
}> {
  const data = await json<{ communities?: unknown[] }>(
    `/api/communities?limit=${limit}`
  )
  return {
    ok: data.ok !== false,
    durable: Boolean(data.durable),
    communities: Array.isArray(data.communities) ? data.communities : [],
  }
}

export async function socialCreateCommunity(input: {
  id?: string
  name: string
  purpose?: string
  description?: string
  privacy?: string
  category?: string
}): Promise<{ ok: boolean; durable: boolean; community?: unknown; id?: string; error?: string }> {
  return json("/api/communities", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function socialJoinCommunity(
  communityId: string
): Promise<{ ok: boolean; durable: boolean; status?: string; error?: string }> {
  return json(`/api/communities/${encodeURIComponent(communityId)}/join`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

export async function socialLeaveCommunity(
  communityId: string
): Promise<{ ok: boolean; durable: boolean; error?: string }> {
  return json(`/api/communities/${encodeURIComponent(communityId)}/join`, {
    method: "DELETE",
  })
}


export async function socialDecideJoinRequest(
  communityId: string,
  applicantId: string,
  approve: boolean
): Promise<{ ok: boolean; durable: boolean; status?: string; error?: string }> {
  return json(`/api/communities/${encodeURIComponent(communityId)}/requests`, {
    method: "POST",
    body: JSON.stringify({ applicantId, approve }),
  })
}

/** Phase 3 curation — quality signal only. Fail-soft if DB down. */
export async function socialSetCuration(
  postId: string,
  choice: "upvote" | "downvote" | "neutral"
): Promise<{
  ok: boolean
  durable?: boolean
  choice?: string
  upvoteCount?: number | null
  downvoteCount?: number | null
  error?: string
  reason?: string
}> {
  const id = String(postId || "").trim()
  if (!id) return { ok: false, error: "INVALID_ID" }
  try {
    return await json(`/api/social/posts/${encodeURIComponent(id)}/curation`, {
      method: "POST",
      body: JSON.stringify({ choice }),
    })
  } catch {
    return { ok: true, durable: false, choice, reason: "NETWORK" }
  }
}

/** Phase 4 reputation — trust signal only. */
export async function socialFetchReputation(): Promise<{
  ok: boolean
  durable?: boolean
  totalPoints?: number
  level?: number
  levelName?: string
  pointsToNext?: number | null
  progressRatio?: number
  error?: string
}> {
  try {
    return await json("/api/social/reputation", { method: "GET" })
  } catch {
    return { ok: true, durable: false, totalPoints: 0, level: 1, levelName: "Seed" }
  }
}

export async function socialRecordReputationEvent(
  eventType: string,
  opts?: { idempotencyKey?: string; sourceRef?: string }
): Promise<{ ok: boolean; error?: string; totalPoints?: number; level?: number }> {
  try {
    return await json("/api/social/reputation", {
      method: "POST",
      body: JSON.stringify({
        eventType,
        idempotencyKey: opts?.idempotencyKey,
        sourceRef: opts?.sourceRef,
      }),
    })
  } catch {
    return { ok: false, error: "NETWORK" }
  }
}

/** Public content reward — amounts only when server has funded/system-written state */
export async function socialFetchContentReward(postId: string): Promise<{
  ok: boolean
  enabled?: boolean
  status?: string
  totalEarned?: number | null
  authorReward?: number | null
  curationReward?: number | null
  upvoteCount?: number
  downvoteCount?: number
  error?: string
}> {
  try {
    return await json(`/api/social/posts/${encodeURIComponent(postId)}/reward`)
  } catch {
    return { ok: false, error: "NETWORK" }
  }
}
