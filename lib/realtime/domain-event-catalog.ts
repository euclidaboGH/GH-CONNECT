/**
 * Stable domain event catalog — predictable names + payload shapes.
 * Domains publish these; UI / notifications / realtime consume them.
 */

import type { DomainEventType } from "./event-bus"

/** Payload contracts (documentational + lightweight runtime helpers) */
export type MessageCreatedPayload = {
  conversationId: string
  messageId: string
  status?: string
}

export type TypingPayload = {
  conversationId: string
  userId: string
}

export type PresencePayload = {
  userId: string
  status: "online" | "away" | "offline"
  lastSeen: number
}

export type RelationshipUserPayload = {
  userId: string
}

export type MatchPayload = {
  matchId?: string
  userId: string
  createsFriendship?: boolean
}

export type PostPayload = {
  postId: string
  visibility?: string
}

export type CommentPayload = {
  postId: string
  commentId: string
  replyTo?: string
}

export type StoryPayload = {
  storyId: string
  status?: string
}

export type CommunityPayload = {
  communityId?: string
  conversationId?: string
  kind?: string
}

export type NotificationPayload = {
  notificationId: string
  category?: string
}

export type MarketplaceOrderPayload = {
  orderId: string
  listingId?: string
  status?: string
}

export type WalletPayload = {
  transferId?: string
  amount?: number
  currency?: string
  status?: string
}

export type RewardPayload = {
  rewardId: string
  kind?: string
  points?: number
}

/** Group event types for realtime channel subscriptions */
export const REALTIME_EVENT_GROUPS = {
  messages: [
    "MESSAGE_CREATED",
    "MESSAGE_UPDATED",
    "MESSAGE_DELETED",
    "MESSAGE_READ",
    "TYPING_STARTED",
    "TYPING_STOPPED",
    "CONVERSATION_CREATED",
  ] as DomainEventType[],
  presence: ["PRESENCE_CHANGED", "TYPING_STARTED", "TYPING_STOPPED"] as DomainEventType[],
  relationships: [
    "FOLLOW_CREATED",
    "FOLLOW_REMOVED",
    "FRIEND_REQUEST_SENT",
    "FRIEND_REQUEST_CANCELLED",
    "FRIEND_REQUEST_REJECTED",
    "FRIEND_ACCEPTED",
    "FRIEND_REMOVED",
    "BLOCK_CREATED",
    "BLOCK_REMOVED",
    "MUTE_CREATED",
    "MUTE_REMOVED",
  ] as DomainEventType[],
  matches: ["MATCH_CREATED", "MATCH_REMOVED"] as DomainEventType[],
  posts: [
    "POST_CREATED",
    "POST_UPDATED",
    "POST_DELETED",
    "LIKE_ADDED",
    "LIKE_REMOVED",
  ] as DomainEventType[],
  comments: ["COMMENT_CREATED", "COMMENT_UPDATED", "COMMENT_DELETED"] as DomainEventType[],
  stories: ["STORY_CREATED", "STORY_EXPIRED", "STORY_VIEWED", "STORY_REACTION"] as DomainEventType[],
  communities: [
    "GROUP_JOINED",
    "GROUP_LEFT",
    "COMMUNITY_ANNOUNCEMENT",
    "COMMUNITY_EVENT",
    "COMMUNITY_POLL",
    "COMMUNITY_ROLE_CHANGED",
  ] as DomainEventType[],
  notifications: ["NOTIFICATION_CREATED", "NOTIFICATION_READ"] as DomainEventType[],
  marketplace: [
    "MARKETPLACE_LISTING_CREATED",
    "MARKETPLACE_LISTING_UPDATED",
    "MARKETPLACE_ORDER_CREATED",
    "MARKETPLACE_ORDER_UPDATED",
    "MARKETPLACE_ORDER_COMPLETED",
  ] as DomainEventType[],
  wallet: [
    "WALLET_BALANCE_UPDATED",
    "WALLET_TRANSFER_CREATED",
    "WALLET_TRANSFER_COMPLETED",
    "WALLET_TRANSFER_FAILED",
  ] as DomainEventType[],
  rewards: ["REWARD_EARNED", "REWARD_REDEEMED", "REWARD_EXPIRED"] as DomainEventType[],
  premium: ["PREMIUM_ACTIVATED", "PREMIUM_EXPIRED", "PREMIUM_UPDATED"] as DomainEventType[],
} as const

export type RealtimeEventGroup = keyof typeof REALTIME_EVENT_GROUPS
