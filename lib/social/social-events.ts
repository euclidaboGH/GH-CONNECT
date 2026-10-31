/**
 * Client-side social mutation signals — not a substitute for durable DB.
 * Triggers authorized re-fetch from APIs after a write is confirmed (or failed).
 */
export const SOCIAL_MUTATION_EVENT = "ghc:social-mutation"

export type SocialMutationKind =
  | "connection_request"
  | "connection_accept"
  | "connection_decline"
  | "follow"
  | "reaction"
  | "comment"
  | "post"
  | "match"

export type SocialMutationDetail = {
  kind: SocialMutationKind
  durable: boolean
  postId?: string
  targetUserId?: string
  error?: string
}

export function emitSocialMutation(detail: SocialMutationDetail): void {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(SOCIAL_MUTATION_EVENT, { detail }))
  } catch {
    /* */
  }
}
