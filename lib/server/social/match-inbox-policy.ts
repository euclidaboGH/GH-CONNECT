/**
 * Privacy projection for the durable match inbox.
 * This is a server-side response filter only; canonical match eligibility and
 * writes remain owned by the database RPCs.
 */
export type MatchInboxProfilePrivacy = {
  profileVisibility?: unknown
  whoCanDiscover?: unknown
}

export function readMatchInboxPrivacy(profilePayload: unknown): MatchInboxProfilePrivacy {
  if (!profilePayload || typeof profilePayload !== "object" || Array.isArray(profilePayload)) return {}
  const root = profilePayload as Record<string, unknown>
  const nested = root.privacySettings && typeof root.privacySettings === "object" && !Array.isArray(root.privacySettings)
    ? root.privacySettings as Record<string, unknown>
    : root.privacy && typeof root.privacy === "object" && !Array.isArray(root.privacy)
      ? root.privacy as Record<string, unknown>
      : {}
  return {
    profileVisibility: nested.profileVisibility,
    whoCanDiscover: nested.whoCanDiscover,
  }
}

export function canAppearInMatchInbox(
  privacy: MatchInboxProfilePrivacy | null | undefined,
  isMutual: boolean,
): boolean {
  const visibility = String(privacy?.profileVisibility ?? "everyone").toLowerCase()
  const discovery = String(privacy?.whoCanDiscover ?? "everyone").toLowerCase()
  if (["hidden", "private", "no-one", "no_one"].includes(visibility)) return false
  if (["hidden", "private", "no-one", "no_one"].includes(discovery)) return false
  if (["matches-only", "matches_only", "matches"].includes(visibility)) return isMutual
  if (["matches-only", "matches_only", "matches"].includes(discovery)) return isMutual
  // Unknown privacy values fail closed rather than silently widening visibility.
  const valid = new Set(["everyone", "public", "followers", "friends", "matches-only", "matches_only", "matches", "hidden", "private", "no-one", "no_one"])
  return valid.has(visibility) && valid.has(discovery)
}

export function blockedPeerIdsForViewer(
  viewerId: string,
  rows: readonly { blocker_id?: unknown; blocked_id?: unknown }[],
): Set<string> {
  const blocked = new Set<string>()
  for (const row of rows) {
    const blocker = String(row.blocker_id ?? "")
    const blockedId = String(row.blocked_id ?? "")
    if (blocker === viewerId && blockedId) blocked.add(blockedId)
    if (blockedId === viewerId && blocker) blocked.add(blocker)
  }
  return blocked
}

export function encodePostgrestInList(values: readonly string[]): string {
  return `in.(${values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",")})`
}
