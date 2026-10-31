/**
 * Privacy enforcement for discovery, messaging, follow/connect, and profile fields.
 * Rules are applied at action/data level — not only CSS hiding.
 */

export type PrivacyAudience = "everyone" | "matches-only" | "no-one" | "hidden"

export type PrivacySettingsSlice = {
  profileVisibility?: PrivacyAudience | string
  whoCanMessage?: PrivacyAudience | string
  whoCanDiscover?: PrivacyAudience | string
  whoCanFollow?: PrivacyAudience | string
  whoCanConnect?: PrivacyAudience | string
  storyVisibility?: PrivacyAudience | string
  showActivity?: boolean
  showInterests?: boolean
  showCommunities?: boolean
  showLocation?: boolean
  onlineStatus?: PrivacyAudience | string
}

function isClose(
  viewerId: string,
  targetId: string,
  matchIds: Set<string>,
  friendIds: Set<string>,
): boolean {
  if (viewerId === targetId || viewerId === "current-user" && targetId === "current-user") return true
  return matchIds.has(targetId) || friendIds.has(targetId)
}

function allows(
  rule: string | undefined,
  everyoneDefault: PrivacyAudience,
  viewerId: string,
  targetId: string,
  matchIds: Set<string>,
  friendIds: Set<string>,
): boolean {
  const r = (rule || everyoneDefault) as string
  if (r === "hidden" || r === "no-one") return viewerId === targetId
  if (r === "matches-only") return isClose(viewerId, targetId, matchIds, friendIds)
  return true // everyone
}

export function canDiscoverProfile(
  settings: PrivacySettingsSlice | null | undefined,
  viewerId: string,
  targetId: string,
  matchIds: string[] = [],
  friendIds: string[] = [],
): boolean {
  if (targetId === viewerId || targetId === "current-user") return true
  const m = new Set(matchIds)
  const f = new Set(friendIds)
  // profileVisibility=hidden removes from discovery entirely for others
  if ((settings?.profileVisibility || "everyone") === "hidden") return false
  return allows(settings?.whoCanDiscover || "everyone", "everyone", viewerId, targetId, m, f)
}

export function canMessageUser(
  settings: PrivacySettingsSlice | null | undefined,
  viewerId: string,
  targetId: string,
  matchIds: string[] = [],
  friendIds: string[] = [],
): boolean {
  if (targetId === viewerId) return false
  const m = new Set(matchIds)
  const f = new Set(friendIds)
  return allows(settings?.whoCanMessage || "everyone", "everyone", viewerId, targetId, m, f)
}

export function canFollowUser(
  settings: PrivacySettingsSlice | null | undefined,
  viewerId: string,
  targetId: string,
  matchIds: string[] = [],
  friendIds: string[] = [],
): boolean {
  if (targetId === viewerId) return false
  const m = new Set(matchIds)
  const f = new Set(friendIds)
  return allows(settings?.whoCanFollow || "everyone", "everyone", viewerId, targetId, m, f)
}

export function canConnectUser(
  settings: PrivacySettingsSlice | null | undefined,
  viewerId: string,
  targetId: string,
  matchIds: string[] = [],
  friendIds: string[] = [],
): boolean {
  if (targetId === viewerId) return false
  const m = new Set(matchIds)
  const f = new Set(friendIds)
  return allows(settings?.whoCanConnect || "everyone", "everyone", viewerId, targetId, m, f)
}

/** Field-level visibility for peer profile views */
export function visibleProfileFields(
  settings: PrivacySettingsSlice | null | undefined,
  isOwner: boolean,
): {
  activity: boolean
  interests: boolean
  communities: boolean
  location: boolean
  online: boolean
} {
  if (isOwner) {
    return { activity: true, interests: true, communities: true, location: true, online: true }
  }
  const s = settings || {}
  return {
    activity: s.showActivity !== false,
    interests: s.showInterests !== false,
    communities: s.showCommunities !== false,
    location: s.showLocation !== false && s.profileVisibility !== "hidden",
    online: (s.onlineStatus || "everyone") !== "hidden",
  }
}
