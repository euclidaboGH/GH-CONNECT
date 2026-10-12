/**
 * Comments UX helpers — presentation only.
 * Never invents comments, reactions, or ownership.
 */

export const MAX_COMMENT_LENGTH = 1000
export const COMMENT_DRAFT_PREFIX = "ghc-comment-draft:"
export const COMMENT_PAGE_SIZE = 40

export function clipCommentText(text: string, max = MAX_COMMENT_LENGTH): string {
  return String(text || "").slice(0, max)
}

export function loadCommentDraft(postId: string): string {
  if (typeof window === "undefined" || !postId) return ""
  try {
    return String(window.localStorage.getItem(COMMENT_DRAFT_PREFIX + postId) || "")
  } catch {
    return ""
  }
}

export function saveCommentDraft(postId: string, text: string): void {
  if (typeof window === "undefined" || !postId) return
  try {
    const t = String(text || "")
    if (!t.trim()) window.localStorage.removeItem(COMMENT_DRAFT_PREFIX + postId)
    else window.localStorage.setItem(COMMENT_DRAFT_PREFIX + postId, t.slice(0, MAX_COMMENT_LENGTH))
  } catch {
    /* */
  }
}

export function clearCommentDraft(postId: string): void {
  if (typeof window === "undefined" || !postId) return
  try {
    window.localStorage.removeItem(COMMENT_DRAFT_PREFIX + postId)
  } catch {
    /* */
  }
}

/** Safe URL detection for optional link affordance (not auto-embed). */
export function extractFirstHttpsUrl(text: string): string | null {
  const m = String(text || "").match(/https:\/\/[^\s<>"']{4,500}/i)
  return m ? m[0] : null
}

export function reactionTotal(reactions?: Record<string, string[] | unknown>): number {
  if (!reactions || typeof reactions !== "object") return 0
  return Object.values(reactions).reduce((sum: number, arr) => {
    return sum + (Array.isArray(arr) ? arr.length : 0)
  }, 0)
}
