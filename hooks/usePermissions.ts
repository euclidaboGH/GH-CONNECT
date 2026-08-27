"use client"

/**
 * Hook: build PermissionContext from live GHC state.
 * All Feed / Profile / Chat / Discovery / Community actions should go through this
 * instead of inventing local permission rules in UI components.
 */

import { useMemo, useCallback } from "react"
import { useGHC } from "@/contexts/ghc-context"
import {
  buildPermissionContext,
  can,
  checkPermission,
  canBlock,
  canComment,
  canConnect,
  canDeleteMessage,
  canDeleteMessageForEveryone,
  canDeletePost,
  canEditPost,
  canFollow,
  canLike,
  canMatch,
  canMessageUser,
  canReact,
  canReply,
  canReport,
  canSave,
  canShare,
  canViewProfile,
  canViewStory,
  canJoinCommunity,
  canInviteToCommunity,
  canBrowseMarketplace,
  canBuyOnMarketplace,
  canSellOnMarketplace,
  canViewWallet,
  canSendFromWallet,
  canClaimReward,
  canUsePremiumFeature,
  isBlocked as permIsBlocked,
  type PermissionAction,
  type PermissionContext,
} from "@/lib/permission-engine"
import {
  isFollowing as graphIsFollowing,
  isBlocked as graphIsBlocked,
  isMatched,
  type SocialGraphSnapshot,
} from "@/lib/social-graph"

export function usePermissions() {
  const {
    following,
    matches,
    friends,
    settings,
    blockedUsers,
    profile,
    followUser,
    blockUser,
    reportUser,
    reportPost,
    reportContent,
  } = useGHC() as any

  const matchIds = useMemo(
    () => (matches || []).map((m: { userId: string }) => m.userId),
    [matches]
  )

  const graph: SocialGraphSnapshot = useMemo(
    () => ({
      blockedUsers: blockedUsers || settings?.blockedUsers || [],
      followingIds: following || [],
      matchIds,
      friendIds: friends || [],
      mutedIds: settings?.mutedUsers || [],
      restrictedIds: [],
    }),
    [blockedUsers, settings?.blockedUsers, settings?.mutedUsers, following, matchIds, friends]
  )

  const ctx: PermissionContext = useMemo(
    () =>
      buildPermissionContext({
        currentUserId: "current-user",
        blockedUsers: graph.blockedUsers,
        followingIds: graph.followingIds,
        matchIds: graph.matchIds,
        friendIds: graph.friendIds,
        mutedIds: graph.mutedIds,
        whoCanMessage: settings?.whoCanMessage,
        profileVisibility: settings?.profileVisibility,
        storyVisibility: settings?.storyVisibility,
        membership: settings?.membership || profile?.membership || "free",
        walletEnabled: settings?.walletEnabled !== false,
        marketplaceEnabled: settings?.marketplaceEnabled !== false,
      }),
    [graph, settings, profile]
  )

  const isFollowing = useCallback((userId: string) => graphIsFollowing(graph, userId), [graph])
  const isBlockedUser = useCallback(
    (userId: string) => graphIsBlocked(graph, userId) || permIsBlocked(ctx, userId),
    [graph, ctx]
  )
  const isMatchedUser = useCallback((userId: string) => isMatched(graph, userId), [graph])

  const check = useCallback(
    (action: PermissionAction, targetId?: string) => checkPermission(ctx, action, targetId),
    [ctx]
  )

  const toggleFollow = useCallback(
    async (userId: string) => {
      const decision = checkPermission(ctx, "follow", userId)
      if (!decision.allowed) return { ok: false as const, reason: decision.reason || "Cannot follow" }
      await followUser?.(userId)
      return { ok: true as const }
    },
    [ctx, followUser]
  )

  const tryBlock = useCallback(
    async (userId: string) => {
      const decision = checkPermission(ctx, "block", userId)
      if (!decision.allowed) return { ok: false as const, reason: decision.reason || "Cannot block" }
      await blockUser?.(userId)
      return { ok: true as const }
    },
    [ctx, blockUser]
  )

  const tryReport = useCallback(
    async (
      targetType: "user" | "post" | "comment" | "message" | "story" | "group",
      targetId: string,
      reason: string
    ) => {
      if (targetType === "user") {
        const decision = checkPermission(ctx, "report", targetId)
        if (!decision.allowed) return { ok: false as const, reason: decision.reason || "Cannot report" }
      }
      if (typeof reportContent === "function") {
        await reportContent(targetType, targetId, reason)
      } else if (targetType === "user") {
        await reportUser?.(targetId, reason)
      } else if (targetType === "post") {
        await reportPost?.(targetId, reason)
      }
      return { ok: true as const }
    },
    [ctx, reportContent, reportUser, reportPost]
  )

  return {
    ctx,
    graph,
    profile,
    isFollowing,
    isBlockedUser,
    isMatchedUser,
    /** Unified API — preferred for new UI */
    check,
    can: (action: PermissionAction, targetId?: string) => can(ctx, action, targetId),
    // Granular booleans (backward compatible)
    canFollow: (id: string) => canFollow(ctx, id),
    canConnect: (id: string) => canConnect(ctx, id),
    canMatch: (id: string) => canMatch(ctx, id),
    canMessage: (id: string) => canMessageUser(ctx, id),
    canViewProfile: (id: string) => canViewProfile(ctx, id),
    canViewStory: (id: string) => canViewStory(ctx, id),
    canLike: (authorId: string) => canLike(ctx, authorId),
    canReact: (authorId: string) => canReact(ctx, authorId),
    canComment: (authorId: string) => canComment(ctx, authorId),
    canReply: (authorId: string) => canReply(ctx, authorId),
    canShare: (authorId?: string) => canShare(ctx, authorId),
    canSave: () => canSave(ctx),
    canDeletePost: (authorId: string) => canDeletePost(ctx, authorId),
    canEditPost: (authorId: string) => canEditPost(ctx, authorId),
    canDeleteMessage: (senderId: string, forEveryone: boolean) =>
      canDeleteMessage(ctx, senderId, forEveryone),
    canDeleteMessageForEveryone: (senderId: string, createdAt: number) =>
      canDeleteMessageForEveryone(ctx, senderId, createdAt),
    canReport: (id: string) => canReport(ctx, id),
    canBlock: (id: string) => canBlock(ctx, id),
    canJoinCommunity: () => canJoinCommunity(ctx),
    canInvite: () => canInviteToCommunity(ctx),
    canBrowseMarketplace: () => canBrowseMarketplace(ctx),
    canBuy: () => canBuyOnMarketplace(ctx),
    canSell: () => canSellOnMarketplace(ctx),
    canViewWallet: () => canViewWallet(ctx),
    canSendWallet: () => canSendFromWallet(ctx),
    canClaimReward: () => canClaimReward(ctx),
    canUsePremium: (feature?: string) => canUsePremiumFeature(ctx, feature),
    toggleFollow,
    tryBlock,
    tryReport,
  }
}
