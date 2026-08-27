/**
 * Backend-ready contracts for per-user privacy and feed mute/block.
 * Client remains non-authoritative: when API is configured, repositories
 * MUST apply these filters server-side and never return hidden fields.
 */

export type ServerPrivacySettings = {
  userId: string
  profileVisibility: "everyone" | "matches-only" | "hidden"
  whoCanDiscover: "everyone" | "matches-only" | "no-one"
  whoCanMessage: "everyone" | "matches-only" | "no-one"
  whoCanFollow: "everyone" | "matches-only" | "no-one"
  whoCanConnect: "everyone" | "matches-only" | "no-one"
  showActivity: boolean
  showInterests: boolean
  showCommunities: boolean
  showLocation: boolean
  onlineStatus: "everyone" | "matches-only" | "hidden"
  updatedAt: number
}

/** GET /api/privacy — returns only the caller's settings */
/** PUT /api/privacy — updates caller's settings (auth required) */

/**
 * Feed query contract — server must exclude:
 * - posts by users in blockedUsers (either direction per product rules)
 * - posts by users in mutedUsers (viewer muted author)
 * - soft-deleted / unpublished posts
 * - posts whose audience excludes the viewer
 */
export type FeedQueryParams = {
  viewerId: string
  cursor?: string
  limit?: number
  mode?: "for-you" | "following" | "friends" | "communities" | "trending"
  /** Server-resolved; client must not trust client-only block lists alone when online */
  excludeAuthorIds?: string[]
}

export type FeedQueryResult = {
  posts: Array<{ id: string; authorId: string }>
  nextCursor?: string
  /** Echo of filter version for cache invalidation */
  filterVersion?: string
}

/**
 * Build excludeAuthorIds for feed fetch from local graph (offline / optimistic).
 * Online path should re-validate on the server.
 */
export function buildFeedExcludeAuthorIds(input: {
  blockedUsers?: string[]
  mutedUsers?: string[]
  blockedBySettings?: string[]
}): string[] {
  return Array.from(
    new Set(
      [
        ...(input.blockedUsers || []),
        ...(input.mutedUsers || []),
        ...(input.blockedBySettings || []),
      ].filter(Boolean),
    ),
  )
}

/**
 * Public profile projection — strip fields the viewer must not see.
 * Call on the server before API responses; client uses the same rules as a fallback.
 */
export function projectPublicProfile<T extends Record<string, unknown>>(
  profile: T,
  opts: {
    isOwner: boolean
    showActivity?: boolean
    showInterests?: boolean
    showCommunities?: boolean
    showLocation?: boolean
    onlineStatus?: string
  },
): Partial<T> {
  if (opts.isOwner) return { ...profile }
  const out: Record<string, unknown> = { ...profile }
  if (opts.showActivity === false) {
    delete out.lastActiveAt
    delete out.lastSeen
  }
  if (opts.showInterests === false) delete out.interests
  if (opts.showCommunities === false) delete out.communities
  if (opts.showLocation === false) {
    delete out.city
    delete out.country
    delete out.location
  }
  if (opts.onlineStatus === "hidden") {
    delete out.online
    delete out.isOnline
  }
  // Never expose wallet / private economy on public profile
  delete out.wallet
  delete out.ghcBalance
  delete out.pendingGhc
  return out as Partial<T>
}
