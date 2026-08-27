/**
 * Build nested comment trees from a flat list (replyTo links).
 * Hardened: never throws on null/partial data; safe for reply UI.
 */

import type { PostComment } from "@/lib/ghc-types"

function normalizeComment(raw: unknown): (PostComment & { replies: PostComment[] }) | null {
  if (!raw || typeof raw !== "object") return null
  const c = raw as PostComment
  if (!c.id || typeof c.id !== "string") return null
  return {
    ...c,
    id: c.id,
    authorId: typeof c.authorId === "string" ? c.authorId : "unknown",
    authorName: typeof c.authorName === "string" && c.authorName.trim() ? c.authorName : "Member",
    authorPhoto: typeof c.authorPhoto === "string" ? c.authorPhoto : undefined,
    text: typeof c.text === "string" ? c.text : "",
    createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
    replyTo: typeof c.replyTo === "string" ? c.replyTo : undefined,
    // Always rebuild nesting from replyTo — ignore pre-nested replies to avoid doubles
    replies: [],
    reactions: c.reactions && typeof c.reactions === "object" ? c.reactions : {},
    reactionCounts: c.reactionCounts && typeof c.reactionCounts === "object" ? c.reactionCounts : {},
    isPinned: Boolean(c.isPinned),
    isEdited: Boolean(c.isEdited),
  }
}

/**
 * Build a forest of comment threads from a flat list.
 * - Safe on null/undefined/non-array
 * - Orphan replies (missing parent) become roots
 * - Never mutates the input array
 */
export function buildCommentTree(comments: PostComment[] | null | undefined): PostComment[] {
  try {
    if (!Array.isArray(comments) || comments.length === 0) return []

    const byId = new Map<string, PostComment & { replies: PostComment[] }>()
    for (const raw of comments) {
      const n = normalizeComment(raw)
      if (!n) continue
      // Prefer first occurrence if duplicates
      if (!byId.has(n.id)) byId.set(n.id, n)
    }

    const roots: PostComment[] = []
    for (const c of byId.values()) {
      const parentId = c.replyTo
      if (parentId && byId.has(parentId) && parentId !== c.id) {
        const parent = byId.get(parentId)!
        if (!parent.replies.some((r) => r.id === c.id)) {
          parent.replies.push(c)
        }
      } else {
        roots.push(c)
      }
    }

    // Sort replies under each node (newest first)
    const sortReplies = (nodes: PostComment[]) => {
      for (const n of nodes) {
        if (Array.isArray(n.replies) && n.replies.length > 1) {
          n.replies.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        }
        if (n.replies?.length) sortReplies(n.replies)
      }
    }
    sortReplies(roots)

    roots.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return (b.createdAt || 0) - (a.createdAt || 0)
    })

    return roots
  } catch {
    // Absolute fallback — never throw into React render
    return Array.isArray(comments)
      ? comments.filter((c) => c && typeof c === "object" && (c as PostComment).id)
      : []
  }
}

function reactionTotal(c: PostComment): number {
  try {
    if (c.reactionCounts && typeof c.reactionCounts === "object") {
      return Object.values(c.reactionCounts).reduce((s, n) => s + (typeof n === "number" ? n : 0), 0)
    }
    if (c.reactions && typeof c.reactions === "object") {
      return Object.values(c.reactions).reduce(
        (s, arr) => s + (Array.isArray(arr) ? arr.length : 0),
        0
      )
    }
  } catch {
    /* ignore */
  }
  return 0
}

export function sortComments(
  comments: PostComment[] | null | undefined,
  mode: "newest" | "liked" | "pinned"
): PostComment[] {
  try {
    const copy = Array.isArray(comments) ? [...comments] : []
    if (mode === "pinned") {
      return copy.sort((a, b) => {
        if (a?.isPinned && !b?.isPinned) return -1
        if (!a?.isPinned && b?.isPinned) return 1
        return (b?.createdAt || 0) - (a?.createdAt || 0)
      })
    }
    if (mode === "liked") {
      return copy.sort((a, b) => {
        const diff = reactionTotal(b) - reactionTotal(a)
        if (diff !== 0) return diff
        return (b?.createdAt || 0) - (a?.createdAt || 0)
      })
    }
    return copy.sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0))
  } catch {
    return Array.isArray(comments) ? comments : []
  }
}

export function countThread(comment: PostComment | null | undefined): number {
  try {
    if (!comment) return 0
    const replies = Array.isArray(comment.replies) ? comment.replies : []
    return replies.reduce((n, r) => n + 1 + countThread(r), 0)
  } catch {
    return 0
  }
}
