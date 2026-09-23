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

export async function socialToggleLike(
  postId: string
): Promise<{
  ok: boolean
  durable: boolean
  liked?: boolean
  likeCount?: number | null
  error?: string
}> {
  return json(`/api/social/posts/${encodeURIComponent(postId)}/reactions`, {
    method: "POST",
    body: JSON.stringify({}),
  })
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
}> {
  const data = await json<{ following?: string[]; followers?: string[] }>(
    "/api/social/follows"
  )
  return {
    ok: data.ok !== false,
    durable: Boolean(data.durable),
    following: Array.isArray(data.following) ? data.following : [],
    followers: Array.isArray(data.followers) ? data.followers : [],
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
