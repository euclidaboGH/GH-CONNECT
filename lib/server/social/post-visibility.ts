import { readGhcServerEnv } from "@/lib/server/economy/env"

type PostRow = { id: string; author_id: string; visibility: string | null; community_id: string | null; deleted_at: string | null }
type FollowRow = { follower_id: string; following_id: string }

/** Fail-closed server-side visibility check shared by comment and reaction routes. */
export async function canViewSocialPost(viewerId: string, postId: string): Promise<boolean | null> {
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(viewerId) || !/^[a-zA-Z0-9_-]{1,180}$/.test(postId)) return false
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const base = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1`
  const headers = { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }
  const get = async (table: string, query: URLSearchParams) => {
    const response = await fetch(`${base}/${table}?${query.toString()}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`VISIBILITY_QUERY_FAILED:${table}`)
    return response.json() as Promise<unknown>
  }
  try {
    const postQuery = new URLSearchParams({ id: `eq.${postId}`, select: "id,author_id,visibility,community_id,deleted_at,archived_at", limit: "1" })
    const posts = await get("gh_posts", postQuery) as PostRow[]
    const post = posts[0]
    if (!post || post.deleted_at || post.archived_at) return false
    if (!/^[a-zA-Z0-9_-]{1,256}$/.test(post.author_id)) return false
    if (post.community_id && !/^[a-zA-Z0-9_-]{1,180}$/.test(post.community_id)) return null
    if (post.author_id === viewerId) return true

    const blockQuery = new URLSearchParams({
      select: "blocker_id,blocked_id",
      or: `(and(blocker_id.eq.${viewerId},blocked_id.eq.${post.author_id}),and(blocker_id.eq.${post.author_id},blocked_id.eq.${viewerId}))`,
      limit: "1",
    })
    const blocks = await get("ghc_user_blocks", blockQuery) as unknown[]
    if (blocks.length) return false

    if (post.community_id) {
      const memberQuery = new URLSearchParams({ community_id: `eq.${post.community_id}`, gh_user_id: `eq.${viewerId}`, status: "eq.active", select: "gh_user_id", limit: "1" })
      const members = await get("gh_community_members", memberQuery) as unknown[]
      if (!members.length) return false
    }

    const visibility = String(post.visibility || "public").toLowerCase()
    if (visibility === "public") return true
    if (!["followers", "mutuals"].includes(visibility)) return false
    const followQuery = new URLSearchParams({
      select: "follower_id,following_id",
      or: `(and(follower_id.eq.${viewerId},following_id.eq.${post.author_id}),and(follower_id.eq.${post.author_id},following_id.eq.${viewerId}))`,
      limit: "2",
    })
    const follows = await get("gh_follows", followQuery) as FollowRow[]
    const viewerFollowsAuthor = follows.some((row) => row.follower_id === viewerId && row.following_id === post.author_id)
    const authorFollowsViewer = follows.some((row) => row.follower_id === post.author_id && row.following_id === viewerId)
    return visibility === "followers" ? viewerFollowsAuthor : viewerFollowsAuthor && authorFollowsViewer
  } catch {
    return null
  }
}

/** Confirms the comment ID belongs to the path post without returning comment content. */
export async function commentBelongsToPost(postId: string, commentId: string): Promise<boolean | null> {
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(postId) || !/^[a-zA-Z0-9_-]{1,180}$/.test(commentId)) return false
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const query = new URLSearchParams({ id: `eq.${commentId}`, post_id: `eq.${postId}`, deleted_at: "is.null", select: "id", limit: "1" })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_post_comments?${query.toString()}`, {
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      cache: "no-store", signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return null
    const rows = await response.json() as unknown[]
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return null
  }
}

/**
 * Batch-check canonical visibility for a page of RPC-returned posts before the
 * payload reaches the browser. A single bounded read per policy table avoids
 * N+1 authorization while covering community-bound posts and mutuals omitted by
 * older feed RPC versions. Null means policy data could not be verified.
 */
export async function filterVisibleSocialPosts(viewerId: string, inputPosts: unknown[]): Promise<unknown[] | null> {
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(viewerId)) return []
  const ids = [...new Set(inputPosts.map((item) => {
    if (!item || typeof item !== "object") return ""
    const post = item as Record<string, unknown>
    const id = String(post.id || post.postId || "")
    return /^[a-zA-Z0-9_-]{1,180}$/.test(id) ? id : ""
  }).filter(Boolean))]
  if (!ids.length) return []
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const base = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1`
  const headers = { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` }
  const get = async (table: string, filters: Record<string, string>) => {
    const query = new URLSearchParams({ ...filters, select: filters.select || "*" })
    const response = await fetch(`${base}/${table}?${query.toString()}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`VISIBILITY_BATCH_FAILED:${table}`)
    return response.json() as Promise<Array<Record<string, unknown>>>
  }
  try {
    const postRows = await get("gh_posts", {
      id: `in.(${ids.join(",")})`, select: "id,author_id,visibility,community_id,deleted_at,archived_at",
      limit: String(Math.min(ids.length, 100)),
    })
    const canonical = new Map(postRows.map((row) => [String(row.id), row]))
    if (postRows.some((row) => {
      const authorId = String(row.author_id || "")
      const communityId = row.community_id == null ? "" : String(row.community_id)
      return !/^[a-zA-Z0-9_-]{1,256}$/.test(authorId) || Boolean(communityId && !/^[a-zA-Z0-9_-]{1,180}$/.test(communityId))
    })) return null
    const authors = [...new Set(postRows.map((row) => String(row.author_id || "")).filter((id) => id && id !== viewerId))]
    const communities = [...new Set(postRows.map((row) => String(row.community_id || "")).filter(Boolean))]
    const [blocks, follows, memberships] = await Promise.all([
      authors.length ? get("ghc_user_blocks", {
        or: `(and(blocker_id.eq.${viewerId},blocked_id.in.(${authors.join(",")})),and(blocked_id.eq.${viewerId},blocker_id.in.(${authors.join(",")})))`,
        select: "blocker_id,blocked_id", limit: "1000",
      }) : Promise.resolve([]),
      authors.length ? get("gh_follows", {
        or: `(and(follower_id.eq.${viewerId},following_id.in.(${authors.join(",")})),and(following_id.eq.${viewerId},follower_id.in.(${authors.join(",")})))`,
        select: "follower_id,following_id", limit: "1000",
      }) : Promise.resolve([]),
      communities.length ? get("gh_community_members", {
        community_id: `in.(${communities.join(",")})`, gh_user_id: `eq.${viewerId}`,
        status: "eq.active", select: "community_id", limit: "1000",
      }) : Promise.resolve([]),
    ])
    const blockedAuthors = new Set<string>()
    for (const row of blocks) {
      if (row.blocker_id === viewerId) blockedAuthors.add(String(row.blocked_id || ""))
      if (row.blocked_id === viewerId) blockedAuthors.add(String(row.blocker_id || ""))
    }
    const viewerFollows = new Set<string>()
    const authorFollowsViewer = new Set<string>()
    for (const row of follows) {
      if (row.follower_id === viewerId) viewerFollows.add(String(row.following_id || ""))
      if (row.following_id === viewerId) authorFollowsViewer.add(String(row.follower_id || ""))
    }
    const activeCommunities = new Set(memberships.map((row) => String(row.community_id || "")))
    return inputPosts.filter((item) => {
      if (!item || typeof item !== "object") return false
      const original = item as Record<string, unknown>
      const id = String(original.id || original.postId || "")
      const post = canonical.get(id)
      if (!post || post.deleted_at || post.archived_at) return false
      const authorId = String(post.author_id || "")
      if (!authorId) return false
      if (authorId === viewerId) return true
      if (blockedAuthors.has(authorId)) return false
      const communityId = post.community_id == null ? "" : String(post.community_id)
      if (communityId && !activeCommunities.has(communityId)) return false
      const visibility = String(post.visibility || "public").toLowerCase()
      if (visibility === "public") return true
      if (visibility === "followers") return viewerFollows.has(authorId)
      if (visibility === "mutuals") return viewerFollows.has(authorId) && authorFollowsViewer.has(authorId)
      return false
    })
  } catch {
    return null
  }
}
