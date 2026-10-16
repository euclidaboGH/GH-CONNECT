/**
 * Phase 9 — Discover / Matches vocabulary (presentation only).
 * Like/Interest ≠ Connection. Match = mutual interest opportunity.
 */

export const MATCH_CLARITY = {
  discoverIntroTitle: "Find people & opportunities",
  discoverIntroBody:
    "Like shows interest for matching. Connect sends a real request. Mutual interest is an opportunity — not an automatic chat.",
  likeLabel: "Like",
  likeHint: "Like for matching — mutual interest is an opportunity, not auto-connect",
  passLabel: "Pass",
  passHint: "Pass — not interested for matching",
  connectLabel: "Connect",
  connectHint: "Send a connection request with your intent",
  emptyPeopleTitle: "No people to show yet",
  emptyPeopleBody:
    "When members appear from connected sources, they show here. Nothing is invented to fill the list.",
  emptySearchTitle: "No matches for this search",
  emptySearchBody: "Try different keywords, clear filters, or broaden connection intents.",
  matchesIntro:
    "Mutual interest only. Connect when you are ready — messaging stays under your control.",
} as const

export function formatIntentChip(id: string): string {
  return String(id || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
