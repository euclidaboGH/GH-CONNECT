/**
 * GH Connect — competitive architecture charter
 *
 * Goal: match Facebook’s spatial discipline and information architecture,
 * then win on Pi-native identity, consent messaging, private communities,
 * transparent ranking, and system-wide safety.
 *
 * Golden mutation path (every user action):
 *   USER ACTION → DOMAIN ACTION → VALIDATION → PERMISSION CHECK
 *   → BACKEND MUTATION → DOMAIN EVENT → REALTIME / NOTIFICATION
 *   → LOCAL CACHE UPDATE → UI
 *
 * Canonical domains: User | Post | Share | Messaging | SocialGraph | Report
 *
 * Content ownership:
 *   Profile = own posts / media / about only
 *   Feed    = network (Following chronological + For You ranked)
 *
 * Chrome policy:
 *   Sticky: bottom nav only (single elevation)
 *   Scroll: cover, identity, posts, about
 *
 * Safety:
 *   Block applies on feed, comments, DM, story, discovery
 *   Report is one sheet: user | post | comment | message | story | group
 *   Message gated by match / accepted follow / existing thread
 */

export const GHC_PRODUCT_PILLARS = [
  "Pi-native verified identity",
  "Consent-based messaging",
  "Private + public communities",
  "Transparent Following vs For You",
  "System-wide block & universal report",
  "Offline-friendly compose & cache",
  "Long-form posts as first-class",
  "Safer default audiences",
] as const

export const AUDIENCE_OPTIONS = [
  { id: "public", label: "Public", description: "Anyone on GH Connect" },
  { id: "followers", label: "Followers", description: "People who follow you" },
  { id: "mutuals", label: "Mutuals", description: "You both follow each other" },
  { id: "private", label: "Only me", description: "Not shown on the network feed" },
] as const

export type CompetitiveAudience = (typeof AUDIENCE_OPTIONS)[number]["id"]
