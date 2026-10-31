/**
 * ShareDomain — reference-based share via golden mutation path.
 * Original post remains canonical; shares only store sourceId + destination.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import {
  ShareService,
  type ShareContext,
  type ShareResult,
  type ShareError,
} from "../share-service"
import type { ShareVisibility } from "../share-types"

export function createShareDomain(getCtx: () => ShareContext) {
  return {
    canShare(postId: string, destination: Parameters<typeof ShareService.canSharePost>[2]) {
      return ShareService.canSharePost(getCtx(), postId, destination)
    },

    async toTimeline(
      postId: string,
      caption?: string,
      visibility: ShareVisibility = "public"
    ): Promise<MutationResult<ShareResult>> {
      const ctx = getCtx()
      return runMutation({
        name: "share.timeline",
        actorId: ctx.currentUserId,
        input: { postId, caption, visibility },
        authorize: (i) => {
          const gate = ShareService.canSharePost(ctx, i.postId, "timeline")
          return gate.ok ? null : gate.error
        },
        mutate: (i) => {
          const result = ShareService.shareToTimeline(ctx, i.postId, i.caption, i.visibility)
          if (!result.ok) throw new Error(result.error)
          return result
        },
        eventType: "POST_UPDATED",
        eventPayload: (r) => ({ kind: "repost", shareId: r.share.id, postId }),
      })
    },

    async toStory(postId: string, caption?: string): Promise<MutationResult<ShareResult>> {
      const ctx = getCtx()
      return runMutation({
        name: "share.story",
        actorId: ctx.currentUserId,
        input: { postId, caption },
        authorize: (i) => {
          const gate = ShareService.canSharePost(ctx, i.postId, "story")
          return gate.ok ? null : gate.error
        },
        mutate: (i) => {
          const result = ShareService.shareToStory(ctx, i.postId, i.caption)
          if (!result.ok) throw new Error(result.error)
          return result
        },
        eventType: "STORY_CREATED",
        eventPayload: (r) => ({ storyId: r.story?.id, sourcePostId: postId }),
      })
    },

    async toPrivateChats(
      postId: string,
      conversationIds: string[],
      caption?: string
    ): Promise<MutationResult<ShareResult>> {
      const ctx = getCtx()
      return runMutation({
        name: "share.private",
        actorId: ctx.currentUserId,
        input: { postId, conversationIds, caption },
        validate: (i) => (!i.conversationIds.length ? "Select at least one chat" : null),
        authorize: (i) => {
          const gate = ShareService.canSharePost(ctx, i.postId, "private_chat")
          return gate.ok ? null : gate.error
        },
        mutate: (i) => {
          const result = ShareService.shareToPrivateChats(
            ctx,
            i.postId,
            i.conversationIds,
            i.caption
          )
          if (!result.ok) throw new Error(result.error)
          return result
        },
        eventType: "MESSAGE_CREATED",
        eventPayload: (r) => ({ kind: "shared_post", postId, conversationIds: r.messages?.map((m) => m.conversationId) }),
      })
    },

    async toGroupChats(
      postId: string,
      conversationIds: string[],
      caption?: string
    ): Promise<MutationResult<ShareResult>> {
      const ctx = getCtx()
      return runMutation({
        name: "share.group",
        actorId: ctx.currentUserId,
        input: { postId, conversationIds, caption },
        validate: (i) => (!i.conversationIds.length ? "Select at least one community" : null),
        authorize: (i) => {
          const gate = ShareService.canSharePost(ctx, i.postId, "group_chat")
          return gate.ok ? null : gate.error
        },
        mutate: (i) => {
          const result = ShareService.shareToGroupChats(
            ctx,
            i.postId,
            i.conversationIds,
            i.caption
          )
          if (!result.ok) throw new Error(result.error)
          return result
        },
        eventType: "MESSAGE_CREATED",
        eventPayload: (r) => ({ kind: "shared_post", postId, conversationIds: r.messages?.map((m) => m.conversationId) }),
      })
    },

    async copyLink(postId: string): Promise<MutationResult<ShareResult>> {
      const ctx = getCtx()
      return runMutation({
        name: "share.copyLink",
        actorId: ctx.currentUserId,
        input: { postId },
        authorize: (i) => {
          const gate = ShareService.canSharePost(ctx, i.postId, "copy_link")
          return gate.ok ? null : gate.error
        },
        mutate: (i) => {
          const result = ShareService.copyPostLink(ctx, i.postId)
          if (!result.ok) throw new Error(result.error)
          return result
        },
        eventType: "POST_UPDATED",
        eventPayload: () => ({ kind: "copy_link", postId }),
      })
    },
  }
}

export type ShareDomain = ReturnType<typeof createShareDomain>
