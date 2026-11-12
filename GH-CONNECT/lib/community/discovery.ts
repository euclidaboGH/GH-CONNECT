/**
 * Phase D — Community discovery filters (presentation helpers).
 */

export type CommunityPrivacyFilter = "all" | "public" | "request" | "invite"

export type CommunityDiscoverSort = "recent" | "active" | "name"

export function normalizeCommunityPrivacy(raw?: string | null): "public" | "request" | "invite" | "private" {
  const p = String(raw || "public").toLowerCase()
  if (p === "private" || p === "approval" || p === "request") return "request"
  if (p === "invite-only" || p === "invite") return "invite"
  if (p === "private_closed") return "private"
  return "public"
}

export function privacyFilterLabel(f: CommunityPrivacyFilter): string {
  switch (f) {
    case "public":
      return "Open join"
    case "request":
      return "Approval"
    case "invite":
      return "Invite only"
    default:
      return "All access"
  }
}

export function matchesPrivacyFilter(
  communityPrivacy: string | null | undefined,
  filter: CommunityPrivacyFilter,
): boolean {
  if (filter === "all") return true
  const n = normalizeCommunityPrivacy(communityPrivacy)
  if (filter === "public") return n === "public"
  if (filter === "request") return n === "request" || n === "private"
  if (filter === "invite") return n === "invite"
  return true
}

export function sortCommunityRows<T extends { name?: string; memberCount?: number; updatedAt?: number; createdAt?: number }>(
  rows: T[],
  sort: CommunityDiscoverSort,
): T[] {
  const copy = [...rows]
  if (sort === "name") {
    copy.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
  } else if (sort === "active") {
    copy.sort((a, b) => (Number(b.memberCount) || 0) - (Number(a.memberCount) || 0))
  } else {
    copy.sort(
      (a, b) =>
        (Number(b.updatedAt || b.createdAt) || 0) - (Number(a.updatedAt || a.createdAt) || 0),
    )
  }
  return copy
}


/** Prefer the server's explicit aggregate count over a partial member-ID projection. */
export function communityMemberCount(row: { memberCount?: unknown; members?: unknown[] }): number {
  const reported = Number(row.memberCount)
  if (row.memberCount !== undefined && row.memberCount !== null && Number.isFinite(reported) && reported >= 0) {
    return Math.floor(reported)
  }
  return Array.isArray(row.members) ? row.members.length : 0
}

/**
 * Board and chat counters are independent lanes. `unreadCount` is a legacy chat
 * fallback only; adding it to `chatUnread` double-counts the same messages.
 */
export function communityUnreadCount(row: {
  boardUnread?: unknown
  chatUnread?: unknown
  unreadCount?: unknown
}): number {
  const nonNegative = (value: unknown): number => {
    const count = Number(value)
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  }
  const chatValue = row.chatUnread !== undefined && row.chatUnread !== null
    ? row.chatUnread
    : row.unreadCount
  return nonNegative(row.boardUnread) + nonNegative(chatValue)
}
