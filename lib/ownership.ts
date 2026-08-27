/**
 * Canonical ownership helpers — same rules on Feed and Profile.
 * Own content: full control (edit/delete).
 * Others' content: report/block/mute; post owner may delete comments on their post.
 */

import type { Profile } from "@/lib/ghc-types"

export const CURRENT_USER_ID = "current-user"

export function isOwnAuthor(
  authorId?: string | null,
  authorName?: string | null,
  profile?: Pick<Profile, "displayName" | "id"> | null,
): boolean {
  if (authorId === CURRENT_USER_ID) return true
  if (profile?.id && authorId && authorId === profile.id) return true
  const name = (authorName || "").trim().toLowerCase()
  const mine = (profile?.displayName || "").trim().toLowerCase()
  if (name && mine && name === mine) return true
  // Optimistic / seed labels
  if (name === "you") return true
  return false
}

export function canEditPost(authorId?: string | null, authorName?: string | null, profile?: Pick<Profile, "displayName" | "id"> | null) {
  return isOwnAuthor(authorId, authorName, profile)
}

export function canDeletePost(authorId?: string | null, authorName?: string | null, profile?: Pick<Profile, "displayName" | "id"> | null) {
  return isOwnAuthor(authorId, authorName, profile)
}

export function canEditComment(
  commentAuthorId?: string | null,
  commentAuthorName?: string | null,
  profile?: Pick<Profile, "displayName" | "id"> | null,
) {
  return isOwnAuthor(commentAuthorId, commentAuthorName, profile)
}

/** Comment author OR post owner may delete a comment */
export function canDeleteComment(
  commentAuthorId?: string | null,
  commentAuthorName?: string | null,
  postAuthorId?: string | null,
  profile?: Pick<Profile, "displayName" | "id"> | null,
) {
  if (isOwnAuthor(commentAuthorId, commentAuthorName, profile)) return true
  if (isOwnAuthor(postAuthorId, null, profile)) return true
  return false
}
