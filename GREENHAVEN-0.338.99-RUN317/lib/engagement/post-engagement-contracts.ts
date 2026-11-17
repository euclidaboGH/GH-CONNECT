/** Post engagement bus + curation count honesty */

export const POST_ENGAGEMENT_EVENT = "ghc:post-engagement"

export type PostEngagementKind = "like" | "comment" | "curation" | "share" | "save" | "edit"

export function emitPostEngagement(detail: {
  postId: string
  kind: PostEngagementKind
  delta?: number
}): void {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(POST_ENGAGEMENT_EVENT, { detail }))
  } catch { /* */ }
}
