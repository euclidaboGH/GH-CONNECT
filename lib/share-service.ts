/**
 * ShareService — single validation + destination routing layer.
 * All share destinations go through canShare → create reference → event.
 */

import type { Post, Conversation, StoryItem } from "./ghc-types"
import type {
  ShareRecord,
  ShareVisibility,
  ShareAnalyticsEvent,
  RepostFeedItem,
} from "./share-types"
import { isBlocked, isSoftDeleted } from "./social-graph"
import { domainEvents } from "./realtime/event-bus"

function id() {
  return `share_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export interface ShareContext {
  currentUserId: string
  blockedUsers: string[]
  posts: Post[]
  conversations: Conversation[]
}

export interface ShareResult {
  ok: true
  share: ShareRecord
  /** Timeline repost entry for feed (reference only) */
  repost?: RepostFeedItem
  /** Story that references the post */
  story?: StoryItem & { sourceType?: string; sourceId?: string }
  /** Message payloads for private/group (type shared_post) */
  messages?: Array<{
    conversationId: string
    text: string
    sharedPostId: string
  }>
  link?: string
  analytics: ShareAnalyticsEvent
}

export interface ShareError {
  ok: false
  error: string
  code: "NOT_FOUND" | "DELETED" | "BLOCKED" | "PRIVATE" | "NO_RECIPIENT" | "DENIED"
}

function findPost(posts: Post[], postId: string) {
  return posts.find((p) => p.id === postId)
}

/**
 * Permission gate before any destination.
 * Private posts must not become public via Share.
 */
export function canSharePost(
  ctx: ShareContext,
  postId: string,
  destination: ShareRecord["destinationType"]
): { ok: true; post: Post } | ShareError {
  const post = findPost(ctx.posts, postId)
  if (!post) return { ok: false, error: "This post is no longer available.", code: "NOT_FOUND" }
  if (isSoftDeleted(post as any)) {
    return { ok: false, error: "This post is no longer available.", code: "DELETED" }
  }
  if (isBlocked({ blockedUsers: ctx.blockedUsers, followingIds: [], matchIds: [], friendIds: [] }, post.authorId)) {
    return { ok: false, error: "You can't share this post.", code: "BLOCKED" }
  }
  const visibility = (post as any).visibility as string | undefined
  if (visibility === "private" && destination === "timeline") {
    // Sharing private to public timeline is denied — keep original visibility authoritative
    return {
      ok: false,
      error: "This post is private and can't be shared publicly.",
      code: "PRIVATE",
    }
  }
  return { ok: true, post }
}

function baseShare(
  post: Post,
  sharerId: string,
  destinationType: ShareRecord["destinationType"],
  destinationId: string | undefined,
  caption?: string,
  visibility?: ShareVisibility
): ShareRecord {
  return {
    id: id(),
    sourceType: "post",
    sourceId: post.id,
    rootPostId: post.id, // share chains always point at original
    sharerId,
    destinationType,
    destinationId,
    caption: caption?.trim().slice(0, 500) || undefined,
    visibility,
    createdAt: Date.now(),
  }
}

function analytics(share: ShareRecord): ShareAnalyticsEvent {
  return {
    sourcePostId: share.sourceId,
    sharerId: share.sharerId,
    destinationType: share.destinationType,
    destinationId: share.destinationId,
    createdAt: share.createdAt,
  }
}

/** Share → My Timeline as a Repost reference (not a copied Post) */
export function shareToTimeline(
  ctx: ShareContext,
  postId: string,
  caption?: string,
  visibility: ShareVisibility = "public"
): ShareResult | ShareError {
  const gate = canSharePost(ctx, postId, "timeline")
  if (!gate.ok) return gate
  const { post } = gate
  // Private original cannot be elevated
  const effectiveVis: ShareVisibility =
    (post as any).visibility === "private" ? "only_me" : visibility

  const share = baseShare(post, ctx.currentUserId, "timeline", ctx.currentUserId, caption, effectiveVis)
  const repost: RepostFeedItem = {
    id: share.id,
    type: "repost",
    sourcePostId: post.id,
    rootPostId: post.id,
    actorId: ctx.currentUserId,
    originalAuthorId: post.authorId,
    caption: share.caption,
    visibility: effectiveVis,
    createdAt: share.createdAt,
  }
  domainEvents.publish("POST_UPDATED", { kind: "repost", shareId: share.id, postId }, ctx.currentUserId)
  return { ok: true, share, repost, analytics: analytics(share) }
}

/** Share → Story reference (tap opens original post) */
export function shareToStory(
  ctx: ShareContext,
  postId: string,
  caption?: string
): ShareResult | ShareError {
  const gate = canSharePost(ctx, postId, "story")
  if (!gate.ok) return gate
  const { post } = gate
  const share = baseShare(post, ctx.currentUserId, "story", ctx.currentUserId, caption)
  const story: StoryItem & { sourceType: string; sourceId: string } = {
    id: share.id,
    ownerId: ctx.currentUserId,
    name: "Your story",
    photo: post.authorPhoto,
    text: caption?.trim() || `Shared a post by ${post.authorName}`,
    media: post.images?.[0] ? { type: "image", url: post.images[0] } : null,
    createdAt: Date.now(),
    sourceType: "post",
    sourceId: post.id,
  }
  domainEvents.publish("STORY_CREATED", { storyId: story.id, sourcePostId: post.id }, ctx.currentUserId)
  return { ok: true, share, story, analytics: analytics(share) }
}

/** Share → one or more private chats (one message each, not a hidden group) */
export function shareToPrivateChats(
  ctx: ShareContext,
  postId: string,
  conversationIds: string[],
  caption?: string
): ShareResult | ShareError {
  const gate = canSharePost(ctx, postId, "private_chat")
  if (!gate.ok) return gate
  if (!conversationIds.length) {
    return { ok: false, error: "Select at least one conversation.", code: "NO_RECIPIENT" }
  }
  const { post } = gate
  const privateIds = conversationIds.filter((cid) => {
    const c = ctx.conversations.find((x) => x.id === cid)
    return c && c.conversationType === "private"
  })
  if (!privateIds.length) {
    return { ok: false, error: "No valid private chats selected.", code: "NO_RECIPIENT" }
  }

  const share = baseShare(post, ctx.currentUserId, "private_chat", privateIds.join(","), caption)
  const body = caption?.trim() || "Check this out 👇"
  const messages = privateIds.map((conversationId) => ({
    conversationId,
    text: body,
    sharedPostId: post.id,
  }))
  domainEvents.publish(
    "MESSAGE_CREATED",
    { kind: "shared_post", postId, conversationIds: privateIds },
    ctx.currentUserId
  )
  return { ok: true, share, messages, analytics: analytics(share) }
}

/** Share → group chat(s) */
export function shareToGroupChats(
  ctx: ShareContext,
  postId: string,
  conversationIds: string[],
  caption?: string
): ShareResult | ShareError {
  const gate = canSharePost(ctx, postId, "group_chat")
  if (!gate.ok) return gate
  if (!conversationIds.length) {
    return { ok: false, error: "Select at least one community.", code: "NO_RECIPIENT" }
  }
  const { post } = gate
  const groupIds = conversationIds.filter((cid) => {
    const c = ctx.conversations.find((x) => x.id === cid)
    return c && c.conversationType === "group"
  })
  if (!groupIds.length) {
    return { ok: false, error: "No valid groups selected.", code: "NO_RECIPIENT" }
  }
  const share = baseShare(post, ctx.currentUserId, "group_chat", groupIds.join(","), caption)
  const body = caption?.trim() || "Shared a post 👇"
  const messages = groupIds.map((conversationId) => ({
    conversationId,
    text: body,
    sharedPostId: post.id,
  }))
  domainEvents.publish(
    "MESSAGE_CREATED",
    { kind: "shared_post", postId, conversationIds: groupIds },
    ctx.currentUserId
  )
  return { ok: true, share, messages, analytics: analytics(share) }
}

/** Copy deep link — does not create a ShareRecord destination except analytics */
export function copyPostLink(ctx: ShareContext, postId: string): ShareResult | ShareError {
  const gate = canSharePost(ctx, postId, "copy_link")
  if (!gate.ok) return gate
  const { post } = gate
  const share = baseShare(post, ctx.currentUserId, "copy_link", undefined)
  const link = `ghconnect://post/${post.id}`
  domainEvents.publish("POST_UPDATED", { kind: "copy_link", postId }, ctx.currentUserId)
  return { ok: true, share, link, analytics: analytics(share) }
}

export const ShareService = {
  canSharePost,
  shareToTimeline,
  shareToStory,
  shareToPrivateChats,
  shareToGroupChats,
  copyPostLink,
}
