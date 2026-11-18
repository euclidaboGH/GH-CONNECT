/**
 * Follow / connect client action helpers — honesty + soft revalidation events.
 */

export function emitSocialGraphChanged(reason: string): void {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent("ghc:social-graph-changed", { detail: { reason } }))
    window.dispatchEvent(new CustomEvent("ghc:connections-refresh", { detail: { reason } }))
  } catch { /* */ }
}

export function humanizeFollowError(code?: string): string {
  switch (code) {
    case "SELF":
      return "You cannot follow yourself."
    case "BLOCKED":
      return "Follow is unavailable for this account."
    case "RATE_LIMIT":
      return "Too many follow actions. Please wait a moment."
    case "UNAUTHORIZED":
      return "Sign in to follow people."
    default:
      return "Could not update follow status. Try again."
  }
}

export function humanizeConnectError(code?: string): string {
  switch (code) {
    case "SELF":
      return "You cannot connect with yourself."
    case "ALREADY_CONNECTED":
      return "You are already connected."
    case "PENDING":
      return "A connection request is already pending."
    case "BLOCKED":
      return "Connection is unavailable for this account."
    default:
      return "Could not send connection request. Try again."
  }
}
