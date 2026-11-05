import { socialRest } from "@/lib/server/social/rpc"

type CommentReactionRow = {
  comment_id?: string
  post_id?: string
  user_id?: string
  emoji?: string
}

export type CommentReactionState = {
  reactionCounts: Record<string, number>
  viewerReactions: string[]
}

/**
 * Batch hydrate persisted comment reactions for already-authorized comments.
 * Returns no user roster; only aggregate counts and the current viewer's emojis.
 * A failed auxiliary read is represented by an empty map so it cannot erase
 * existing payload fields or be mistaken for a successful canonical read.
 */
export async function loadCommentReactionState(
  comments: Array<{ id?: unknown }>,
  viewerId: string,
): Promise<Map<string, CommentReactionState>> {
  const ids = Array.from(new Set(comments
    .map((comment) => String(comment?.id || "").trim())
    .filter((id) => /^[a-zA-Z0-9_-]{1,160}$/.test(id))))
    .slice(0, 600)
  const out = new Map<string, CommentReactionState>()
  if (!ids.length || !/^[a-zA-Z0-9_-]{1,256}$/.test(viewerId)) return out

  const filter = `in.(${ids.map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",")})`
  const query = new URLSearchParams({
    comment_id: filter,
    select: "comment_id,user_id,emoji",
    limit: "5000",
  })
  const result = await socialRest<CommentReactionRow[]>(`gh_comment_reactions?${query.toString()}`)
  if (!result.ok || !Array.isArray(result.data)) return out

  for (const row of result.data) {
    const id = String(row.comment_id || "")
    const emoji = String(row.emoji || "").trim().slice(0, 16)
    if (!ids.includes(id) || !emoji) continue
    const state = out.get(id) || { reactionCounts: {}, viewerReactions: [] }
    state.reactionCounts[emoji] = (state.reactionCounts[emoji] || 0) + 1
    if (String(row.user_id || "") === viewerId && !state.viewerReactions.includes(emoji)) {
      state.viewerReactions.push(emoji)
    }
    out.set(id, state)
  }
  // A successful read with no rows must still distinguish no reactions from an
  // unavailable read; initialize explicit empty state for all returned IDs.
  for (const id of ids) if (!out.has(id)) out.set(id, { reactionCounts: {}, viewerReactions: [] })
  return out
}
