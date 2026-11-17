/**
 * Communities domain contract — Belonging pillar.
 * Discover → Connect → Communicate → Belong → Participate.
 */

import type { DomainResult, DomainEmptyState } from "./types"

export type CommunityMembershipState =
  | "discoverable"
  | "invited"
  | "pending"
  | "member"
  | "moderator"
  | "admin"
  | "owner"
  | "blocked"
  | "unavailable"

export type CommunityVisibility = "public" | "private" | "invite-only" | "invite" | string

export type CommunityJoinReasonId =
  | "learn"
  | "connect"
  | "collaborate"
  | "volunteer"
  | "opportunities"
  | "share_knowledge"
  | "events"
  | "support"

export const COMMUNITY_JOIN_REASON_OPTIONS: {
  id: CommunityJoinReasonId
  label: string
  description: string
}[] = [
  { id: "learn", label: "Learn", description: "Skills, topics, and shared learning" },
  { id: "connect", label: "Connect", description: "Meet people with shared interests" },
  { id: "collaborate", label: "Collaborate", description: "Build or work on projects together" },
  { id: "volunteer", label: "Volunteer", description: "Give time to causes and community work" },
  { id: "opportunities", label: "Find opportunities", description: "Roles, gigs, and openings" },
  { id: "share_knowledge", label: "Share knowledge", description: "Teach, mentor, or publish" },
  { id: "events", label: "Participate in events", description: "Meetups and live activities" },
  { id: "support", label: "Support the community", description: "Help members and moderators" },
]

export interface CommunitySummary {
  id: string
  name: string
  privacy: CommunityVisibility
  memberCount: number
  isMember: boolean
  membershipState?: CommunityMembershipState
  region?: string
  category?: string
  description?: string
  tags?: string[]
  coverImage?: string
}

export interface CommunityOverviewModel {
  id: string
  name: string
  description?: string
  purpose?: string
  category?: string
  tags?: string[]
  region?: string
  privacy: CommunityVisibility
  coverImage?: string
  memberCount: number
  membershipState: CommunityMembershipState
  roleLabel?: string
  rules: string[]
  ownerId?: string
  hasDiscussions: boolean
  hasEvents: boolean
  hasActivities: boolean
  hasResources: boolean
  hasAnnouncements: boolean
  discussionCount?: number
  eventCount?: number
  dataSource: "community_domain" | "conversation_row" | "registry" | "unavailable"
}

export interface CommunityJoinIntent {
  communityId: string
  reasons: CommunityJoinReasonId[]
  note?: string
}

export interface CommunitiesDomainContract {
  listMine(): DomainResult<CommunitySummary[]>
  listDiscoverable(): DomainResult<CommunitySummary[]>
  getOverview?(communityId: string): DomainResult<CommunityOverviewModel | null>
  emptyState(): DomainEmptyState
}

export function communitiesEmptyState(): DomainEmptyState {
  return {
    title: "No communities yet",
    description: "Join or create a community to collaborate around shared interests.",
    primaryAction: { label: "Explore communities", tab: "discover" },
  }
}

export function communityDiscoverEmptyState(): DomainEmptyState {
  return {
    title: "No communities to discover",
    description:
      "When communities are available on GreenHaven, they will appear here. Nothing is fabricated for display.",
    primaryAction: { label: "Back to Discover", tab: "discover" },
  }
}

export function membershipStateLabel(state: CommunityMembershipState): string {
  switch (state) {
    case "owner":
      return "Owner"
    case "admin":
      return "Admin"
    case "moderator":
      return "Moderator"
    case "member":
      return "Member"
    case "pending":
      return "Request pending"
    case "invited":
      return "Invited"
    case "blocked":
    case "unavailable":
      return "Unavailable"
    case "discoverable":
    default:
      return "Not a member"
  }
}

export function primaryMembershipAction(
  state: CommunityMembershipState
): "join" | "request" | "pending" | "accept_invite" | "open" | "none" {
  switch (state) {
    case "discoverable":
      return "join"
    case "pending":
      return "pending"
    case "invited":
      return "accept_invite"
    case "member":
    case "moderator":
    case "admin":
    case "owner":
      return "open"
    case "blocked":
    case "unavailable":
      return "none"
    default:
      return "join"
  }
}
