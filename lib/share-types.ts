/**
 * Share System — reference-based, never duplicates the original post.
 * Golden rule: Share → sourceId → original Post.
 */

export type ShareSourceType = "post" | "story" | "profile"
export type ShareDestinationType =
  | "timeline"
  | "story"
  | "private_chat"
  | "group_chat"
  | "copy_link"
  | "external"

export type ShareVisibility =
  | "public"
  | "followers"
  | "friends"
  | "mutuals"
  | "only_me"

/** Canonical share record — references original, never copies body/media */
export interface ShareRecord {
  id: string
  sourceType: ShareSourceType
  /** Always the root original post id (share chains resolve here) */
  sourceId: string
  rootPostId: string
  sharerId: string
  destinationType: ShareDestinationType
  destinationId?: string
  caption?: string
  visibility?: ShareVisibility
  createdAt: number
}

/** Timeline repost feed item — UI renders original via sourcePostId */
export interface RepostFeedItem {
  id: string
  type: "repost"
  sourcePostId: string
  rootPostId: string
  actorId: string
  originalAuthorId: string
  caption?: string
  visibility: ShareVisibility
  createdAt: number
}

export interface ShareAnalyticsEvent {
  sourcePostId: string
  sharerId: string
  destinationType: ShareDestinationType
  destinationId?: string
  createdAt: number
}

export type ShareSheetDestination =
  | { kind: "timeline"; visibility: ShareVisibility }
  | { kind: "story" }
  | { kind: "private_chat"; conversationIds: string[] }
  | { kind: "group_chat"; conversationIds: string[] }
  | { kind: "copy_link" }
