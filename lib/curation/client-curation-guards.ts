/**
 * Client-side curation guards — server remains authoritative.
 */

export const CURATION_UI_DEBOUNCE_MS = 400

export function isSelfCuration(viewerId: string | null | undefined, authorId: string | null | undefined): boolean {
  if (!viewerId || !authorId) return false
  return String(viewerId) === String(authorId)
}

export function humanizeCurationError(code?: string): string {
  switch (code) {
    case "SELF_CURATION":
    case "SELF":
      return "You cannot curate your own post."
    case "RATE_LIMIT":
    case "QUOTA":
      return "Daily curation limit reached. Try again tomorrow."
    case "UNAUTHORIZED":
      return "Sign in to curate posts."
    case "NOT_FOUND":
      return "This post is no longer available."
    case "BLOCKED":
      return "Curation is unavailable for this post."
    default:
      return "Could not update curation. Try again."
  }
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
