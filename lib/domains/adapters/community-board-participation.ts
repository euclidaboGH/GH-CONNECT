/**
 * Board participation adapter — replies & reactions over community domain.
 * Same local-first authority as createBoardPost (conversation boardPosts).
 */

export type BoardReactionType = "like"

export interface BoardReply {
  id: string
  postId: string
  authorId: string
  authorName: string
  body: string
  createdAt: number
}

export interface BoardPostView {
  id: string
  communityId: string
  authorId?: string
  authorName?: string
  body?: string
  createdAt?: number
  likes?: number
  comments?: number
  replies?: BoardReply[]
  likedBy?: string[]
}

export function sortRepliesChronological(replies: BoardReply[] | undefined): BoardReply[] {
  return [...(replies || [])].sort((a, b) => a.createdAt - b.createdAt)
}

export function isLikedBy(post: BoardPostView, userId: string): boolean {
  return Array.isArray(post.likedBy) && post.likedBy.includes(userId)
}

/** Apply reply result onto a post list (immutable). */
export function applyReplyToPosts(
  posts: BoardPostView[],
  postId: string,
  reply: BoardReply,
  comments: number
): BoardPostView[] {
  return posts.map((p) =>
    p.id === postId
      ? {
          ...p,
          replies: sortRepliesChronological([...(p.replies || []), reply]),
          comments,
        }
      : p
  )
}

/** Apply reaction result onto a post list (immutable). */
export function applyReactionToPosts(
  posts: BoardPostView[],
  postId: string,
  likes: number,
  likedBy: string[]
): BoardPostView[] {
  return posts.map((p) => (p.id === postId ? { ...p, likes, likedBy } : p))
}
