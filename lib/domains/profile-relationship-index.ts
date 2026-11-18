/**
 * Per-domain relationship indexes for profile and people-list hydration.
 *
 * The index is a derived view of canonical social-graph arrays, never a store.
 * A new index is prepared only when one of those immutable source arrays changes.
 * Each ProfileDomain instance owns its own cache, so account switches cannot
 * reuse another identity's graph.
 */

export interface ProfileRelationshipSources {
  following?: readonly string[]
  followers?: readonly string[]
  friends?: readonly string[]
  matches?: readonly { userId: string }[]
  blocked?: readonly string[]
  muted?: readonly string[]
  restricted?: readonly string[]
  outgoingRequests?: readonly string[]
  incomingRequests?: readonly string[]
}

export interface ProfileRelationshipIndex {
  readonly following: ReadonlySet<string>
  readonly followers: ReadonlySet<string>
  readonly friends: ReadonlySet<string>
  readonly matches: ReadonlySet<string>
  readonly blocked: ReadonlySet<string>
  readonly muted: ReadonlySet<string>
  readonly restricted: ReadonlySet<string>
  readonly outgoingRequests: ReadonlySet<string>
  readonly incomingRequests: ReadonlySet<string>
}

export const MAX_PROFILE_RELATIONSHIP_IDS = 50_000
export const MAX_PROFILE_ID_LENGTH = 256
export const DEFAULT_PROFILE_BATCH_LIMIT = 500

function isSafeProfileId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_PROFILE_ID_LENGTH && !/[\u0000-\u001f\u007f]/.test(value)
}

function toIdSet(values: readonly string[] | undefined): ReadonlySet<string> {
  const result = new Set<string>()
  for (const value of values || []) {
    if (!isSafeProfileId(value)) continue
    const id = value.trim()
    if (!id) continue
    result.add(id)
    // Bound derived memory even if a malformed upstream graph is unexpectedly large.
    if (result.size >= MAX_PROFILE_RELATIONSHIP_IDS) break
  }
  return result
}

export function buildProfileRelationshipIndex(
  sources: ProfileRelationshipSources,
): ProfileRelationshipIndex {
  return {
    following: toIdSet(sources.following),
    followers: toIdSet(sources.followers),
    friends: toIdSet(sources.friends),
    matches: toIdSet((sources.matches || []).map((match) => match?.userId || "")),
    blocked: toIdSet(sources.blocked),
    muted: toIdSet(sources.muted),
    restricted: toIdSet(sources.restricted),
    outgoingRequests: toIdSet(sources.outgoingRequests),
    incomingRequests: toIdSet(sources.incomingRequests),
  }
}

const EMPTY_STRINGS: readonly string[] = Object.freeze([])
const EMPTY_MATCHES: readonly { userId: string }[] = Object.freeze([])

/** Caches each derived set independently by canonical immutable source identity. */
export function createProfileRelationshipIndexCache(
  readSources: () => ProfileRelationshipSources,
): () => ProfileRelationshipIndex {
  const previous: Partial<Required<ProfileRelationshipSources>> = {}
  type Mutable<T> = { -readonly [K in keyof T]: T[K] }
  const sets: Partial<Mutable<ProfileRelationshipIndex>> = {}

  return () => {
    const current = readSources()
    const next: Required<ProfileRelationshipSources> = {
      following: current.following || EMPTY_STRINGS,
      followers: current.followers || EMPTY_STRINGS,
      friends: current.friends || EMPTY_STRINGS,
      matches: current.matches || EMPTY_MATCHES,
      blocked: current.blocked || EMPTY_STRINGS,
      muted: current.muted || EMPTY_STRINGS,
      restricted: current.restricted || EMPTY_STRINGS,
      outgoingRequests: current.outgoingRequests || EMPTY_STRINGS,
      incomingRequests: current.incomingRequests || EMPTY_STRINGS,
    }

    const stringKeys = [
      "following", "followers", "friends", "blocked", "muted",
      "restricted", "outgoingRequests", "incomingRequests",
    ] as const
    for (const key of stringKeys) {
      if (previous[key] !== next[key] || !sets[key]) {
        sets[key] = toIdSet(next[key])
        previous[key] = next[key]
      }
    }
    if (previous.matches !== next.matches || !sets.matches) {
      sets.matches = toIdSet(next.matches.map((match) => match?.userId || ""))
      previous.matches = next.matches
    }

    return { ...sets } as ProfileRelationshipIndex
  }
}

/**
 * Batch hydration is keyed by normalized ID. Duplicate, empty and malformed IDs
 * are ignored, preventing duplicate work and ambiguous output entries.
 */
export function uniqueProfileIds(
  userIds: readonly unknown[],
  limit = DEFAULT_PROFILE_BATCH_LIMIT,
): string[] {
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(0, Math.min(limit, 5_000)) : DEFAULT_PROFILE_BATCH_LIMIT
  const seen = new Set<string>()
  const result: string[] = []
  if (safeLimit === 0) return result
  for (const value of userIds) {
    if (!isSafeProfileId(value)) continue
    const id = value.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
    if (result.length >= safeLimit) break
  }
  return result
}
