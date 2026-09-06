/**
 * Feed / Social domain contract.
 * Presentation over the post store — not economy.
 */

import type { DomainResult, DomainEmptyState } from "./types"
import type { CanonicalFeedMode } from "@/lib/domains/feed-domain"
import type { SocialContentKind } from "@/lib/domains/adapters/social-content-kinds"

export interface FeedPostSummary {
  id: string
  authorId: string
  authorName: string
  preview: string
  createdAt: string
  likeCount: number
  commentCount: number
  contentKind?: SocialContentKind
}

export interface FeedDomainContract {
  list(mode: CanonicalFeedMode, limit?: number): DomainResult<FeedPostSummary[]>
  emptyState(mode: CanonicalFeedMode): DomainEmptyState
}

export function feedEmptyState(mode: CanonicalFeedMode): DomainEmptyState {
  return {
    title: mode === "following" ? "Your following feed is quiet" : "Nothing here yet",
    description:
      mode === "following"
        ? "Follow people and communities to see their updates here."
        : "Share something useful when you are ready — photo, text, or community update.",
    primaryAction: { label: "Create a post", tab: "create" },
  }
}
