/**
 * Client-side curation guards — server remains authoritative.
 */

export const CURATION_UI_DEBOUNCE_MS = 400

export function isSelfCuration(viewerId: string | null | undefined, authorId: string | null | undefined): boolean {
  if (!viewerId || !authorId) return false
  return String(viewerId) === String(authorId)
}

export function humanizeCurationError(code?: string): string {
  const c = String(code || "").toUpperCase()
  switch (c) {
    case "SELF_CURATION":
    case "SELF":
    case "OWN_POST":
      return "You cannot curate your own post."
    case "QUOTA":
      return "Daily curation limit reached. Try again tomorrow."
    case "RATE_LIMIT":
    case "RATE_LIMITED":
      // The server does not say whether this is a burst or a daily limit, so do not claim "daily".
      return "You're voting too quickly. Wait a moment and try again."
    case "UNAUTHORIZED":
    case "AUTH_REQUIRED":
      return "Sign in to curate posts."
    case "NOT_FOUND":
    case "POST_NOT_FOUND":
      return "This post is no longer available."
    case "BLOCKED":
    case "FORBIDDEN":
      return "Curation is unavailable for this post."
    case "DURABLE_WRITE_REQUIRED":
    case "STORE_UNAVAILABLE":
    case "DATABASE_UNAVAILABLE":
      return "Curation could not be saved right now. Try again shortly."
    case "INVALID_CHOICE":
    case "INVALID_ID":
      return "That curation action is not valid."
    case "NETWORK":
      return "Could not vote — check connection."
    default:
      return CURATION_DEFAULT_ERROR
  }
}

export const CURATION_DEFAULT_ERROR = "Could not update curation. Try again."

/** True when the code maps to a specific, user-meaningful message (not the generic fallback). */
export function isKnownCurationError(code?: string): boolean {
  return humanizeCurationError(code) !== CURATION_DEFAULT_ERROR
}

/** Optimistic choice helpers — never invent ledger rewards */
export type CurationChoice = "upvote" | "downvote" | "neutral"

export function nextCurationChoice(current: CurationChoice, action: "upvote" | "downvote"): CurationChoice {
  if (current === action) return "neutral"
  return action
}

/** Quieter label for community quality — avoid prototype "Weight 100%" language. */
export function curationQualityLabel(scorePercent: number | null | undefined): string {
  if (scorePercent == null || !Number.isFinite(scorePercent)) return "Community rated"
  const n = Math.max(0, Math.min(100, Math.round(scorePercent)))
  if (n >= 85) return "Highly rated"
  if (n >= 60) return "Well rated"
  if (n >= 40) return "Mixed rating"
  return "Needs support"
}
