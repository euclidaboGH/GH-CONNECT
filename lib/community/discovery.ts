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
