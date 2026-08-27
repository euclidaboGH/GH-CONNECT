/**
 * Canonical relationship language for GH Connect.
 * Follow ≠ Connect ≠ Match — same meaning on Feed, Find, Profile, Community.
 */

export const RELATIONSHIP_LANGUAGE = {
  follow: {
    action: "Follow",
    active: "Following",
    undo: "Unfollow",
    meaning: "See their public posts and activity",
    tone: "emerald" as const,
  },
  connect: {
    action: "Connect",
    active: "Connected",
    pending: "Requested",
    accept: "Accept",
    meaning: "Request a mutual friendship connection",
    tone: "teal" as const,
  },
  match: {
    action: "Match",
    active: "Matched",
    undo: "Unmatch",
    meaning: "Mutual intentional interest — not automatic friendship",
    tone: "rose" as const,
  },
  message: {
    action: "Message",
    request: "Message request",
    meaning: "Private conversation when allowed",
    tone: "stone" as const,
  },
} as const

export type RelationshipKind = keyof typeof RELATIONSHIP_LANGUAGE

/** Short legend string for headers (English default; swap via i18n later). */
export function relationshipLegendText(): string {
  const L = RELATIONSHIP_LANGUAGE
  return `${L.follow.action}: ${L.follow.meaning.split(" ").slice(0, 3).join(" ")} · ${L.connect.action}: mutual friendship · ${L.match.action}: intentional interest`
}
