/**
 * Non-authoritative community UI cache helpers.
 * Every persisted community hint is isolated to the active GreenHaven identity.
 * These values must never grant membership, moderation, or content access.
 */

const MAX_ID_LENGTH = 256
const MAX_JOINED_IDS = 5_000
const MAX_COMMUNITY_CACHE_ENTRIES = 500
const MAX_POSTS_PER_COMMUNITY = 100

const ALLOWED_KEYS = new Set([
  "ghc.community.joinedIds",
  "ghc.community.joinedIds.session",
  "ghc.community.boardPosts",
])

export function communityAccountStorageKey(baseKey: string, userId: string | null | undefined): string | null {
  if (!ALLOWED_KEYS.has(baseKey)) return null
  const identity = String(userId || "anonymous").trim() || "anonymous"
  if (identity.length > MAX_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(identity)) return null
  return `${baseKey}:v2:${encodeURIComponent(identity)}`
}

export function parseCommunityJoinedIds(raw: string | null): string[] {
  if (!raw || raw.length > 512_000) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const result: string[] = []
    for (const value of parsed) {
      if (typeof value !== "string") continue
      const id = value.trim()
      if (!id || id.length > MAX_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(id) || seen.has(id)) continue
      seen.add(id)
      result.push(id)
      if (result.length >= MAX_JOINED_IDS) break
    }
    return result
  } catch {
    return []
  }
}

export function parseCommunityBoardCache<T = Record<string, unknown>>(raw: string | null): Record<string, T[]> {
  if (!raw || raw.length > 2_000_000) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const result: Record<string, T[]> = {}
    for (const [communityId, posts] of Object.entries(parsed as Record<string, unknown>).slice(0, MAX_COMMUNITY_CACHE_ENTRIES)) {
      if (!communityId || communityId.length > MAX_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(communityId) || !Array.isArray(posts)) continue
      result[communityId] = posts.filter((post) => Boolean(post) && typeof post === "object" && !Array.isArray(post)).slice(0, MAX_POSTS_PER_COMMUNITY) as T[]
    }
    return result
  } catch {
    return {}
  }
}
