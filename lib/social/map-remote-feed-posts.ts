import type { Post } from "@/lib/ghc-types"
import { normalizeEngagementMetrics } from "@/lib/engagement/post-engagement"

/** Normalize durable API feed rows into the canonical client Post shape. */
function finiteCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
}

function timestampMs(value: unknown, fallback: number): number {
  if (typeof value === "string" && value.trim() && !/^\d+(\.\d+)?$/.test(value.trim())) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  // Durable APIs may return Unix seconds; the client model stores milliseconds.
  return parsed < 100_000_000_000 ? Math.round(parsed * 1000) : Math.round(parsed)
}

export function mapRemoteFeedPosts(feedPosts: Partial<Post>[] | Record<string, unknown>[]): Post[] {
  return (feedPosts || []).map((raw) => {
    const p = raw as Record<string, unknown>
    const id = String(p.id || p.post_id || "")
    const authorId = String(p.authorId || p.author_id || "")
    const imagesRaw = p.images ?? p.image_urls ?? p.media
    const images = Array.isArray(imagesRaw)
      ? imagesRaw.map(String).filter(Boolean)
      : typeof imagesRaw === "string" && imagesRaw
        ? [imagesRaw]
        : []
    const commentsRaw = p.comments
    const comments = Array.isArray(commentsRaw) ? (commentsRaw as Post["comments"]) : []
    const commentCount = finiteCount(p.commentCount ?? p.comment_count ?? ((p.engagement && typeof p.engagement === "object") ? (p.engagement as Record<string, unknown>).comments : undefined) ?? comments.length)
    const reactionCounts = p.reactionCounts && typeof p.reactionCounts === "object"
      ? Object.fromEntries(Object.entries(p.reactionCounts as Record<string, unknown>).map(([key, value]) => [key, finiteCount(value)]))
      : {}
    const viewerReactions = Array.isArray(p.viewerReactions) ? p.viewerReactions.map(String) : []
    const visibilityRaw = String(p.visibility || p.visible_to || "public").toLowerCase()
    const visibility = (
      ["public", "followers", "mutuals", "private"].includes(visibilityRaw)
        ? visibilityRaw
        : "public"
    ) as Post["visibility"]
    const likes = finiteCount(p.likes ?? p.like_count ?? p.likeCount)
    const shares = finiteCount(p.shares ?? p.share_count)
    const viewCount = finiteCount(p.viewCount ?? p.view_count)
    const upvoteCount = finiteCount(p.upvoteCount ?? p.upvote_count)
    const downvoteCount = finiteCount(p.downvoteCount ?? p.downvote_count)
    const viewerCurationRaw = String(p.viewerCurationChoice ?? p.viewer_curation_choice ?? p.curationChoice ?? "").toLowerCase()
    const viewerCurationChoice =
      viewerCurationRaw === "upvote" || viewerCurationRaw === "downvote" ? viewerCurationRaw : undefined
    const createdAt = timestampMs(p.createdAt ?? p.created_at, Date.now())
    const deletedAtRaw = p.deletedAt ?? p.deleted_at
    const deletedAt =
      deletedAtRaw != null && deletedAtRaw !== ""
        ? timestampMs(deletedAtRaw, 0)
        : null
    return {
      id,
      authorId,
      authorName: String(p.authorName || p.author_name || "Member"),
      authorPhoto: String(p.authorPhoto || p.author_photo || ""),
      content: String(p.content || p.body || ""),
      images,
      video: (p.video as string | null) ?? (p.video_url as string | null) ?? null,
      pdf: (p.pdf as string | null) ?? null,
      pdfName: (p.pdfName as string | null) ?? (p.pdf_name as string | null) ?? null,
      likes,
      comments,
      createdAt,
      engagement: normalizeEngagementMetrics(
        p.engagement && typeof p.engagement === "object" ? p.engagement as Post["engagement"] : undefined,
        { likes, comments: commentCount, shares, views: viewCount },
      ),
      reactionCounts,
      viewerReactions,
      visibility,
      deletedAt: Number.isFinite(deletedAt as number) ? (deletedAt as number) : null,
      isEdited: Boolean(p.isEdited ?? p.is_edited),
      editedAt: p.editedAt || p.edited_at ? timestampMs(p.editedAt || p.edited_at, createdAt) : undefined,
      hashtags: Array.isArray(p.hashtags) ? p.hashtags.map(String) : undefined,
      mentions: Array.isArray(p.mentions) ? p.mentions.map(String) : undefined,
      communityId: p.communityId || p.community_id ? String(p.communityId || p.community_id) : undefined,
      communityName: p.communityName || p.community_name ? String(p.communityName || p.community_name) : undefined,
      listingId: p.listingId || p.listing_id ? String(p.listingId || p.listing_id) : undefined,
      listingKind: (p.listingKind || p.listing_kind) as Post["listingKind"],
      contentType: (p.contentType || p.content_type) as Post["contentType"],
      shares: shares || undefined,
      viewCount: viewCount || undefined,
      upvoteCount,
      downvoteCount,
      viewerCurationChoice,
      quoteOf: p.quoteOf || p.quote_of_post_id ? String(p.quoteOf || p.quote_of_post_id) : undefined,
    } as Post
  }).filter((p) => Boolean(p.id))
}

