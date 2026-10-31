/**
 * Discovery / Matching domain contract — multi-object discriminated union.
 * Explainable reasons only — no unexplained fake % scores in production UI.
 */

import type { ConnectionIntentId } from "@/lib/connection-intents"
import type { DomainResult, DomainEmptyState, ExplainableReason } from "./types"

export type DiscoveryCategory =
  | "people"
  | "friends"
  | "professionals"
  | "collaborators"
  | "mentors"
  | "communities"
  | "events"
  | "activities"
  | "services"

export type DiscoveryObjectKind =
  | "person"
  | "community"
  | "event"
  | "activity"
  | "service"

interface DiscoveryObjectBase {
  id: string
  kind: DiscoveryObjectKind
  /** Category that produced this result */
  category: DiscoveryCategory
  displayName: string
  subtitle?: string
  reasons: ExplainableReason[]
  /** Internal ranking only — never show as match % */
  rankScore?: number
}

export interface PersonCandidate extends DiscoveryObjectBase {
  kind: "person"
  avatarUrl?: string | null
  locationLabel?: string | null
  interests?: string[]
  intents?: ConnectionIntentId[]
  profession?: string
}

export interface CommunityCandidate extends DiscoveryObjectBase {
  kind: "community"
  purpose?: string
  memberCount?: number
  privacy?: string
  tags?: string[]
  region?: string
  coverImage?: string
}

export interface EventCandidate extends DiscoveryObjectBase {
  kind: "event"
  startsAt?: string
  endsAt?: string
  locationLabel?: string | null
  isOnline?: boolean
  communityId?: string
  communityName?: string
  organizerId?: string
}

export interface ActivityCandidate extends DiscoveryObjectBase {
  kind: "activity"
  activityType?: string
  status?: string
  communityId?: string
  communityName?: string
  organizerId?: string
  organizerName?: string
}

export interface ServiceCandidate extends DiscoveryObjectBase {
  kind: "service"
  providerId?: string
  providerName?: string
  serviceCategory?: string
  tags?: string[]
  locationLabel?: string | null
  /** Display only — not a payment action from Discovery */
  priceLabel?: string
}

/** Discriminated discovery result */
export type DiscoveryCandidate =
  | PersonCandidate
  | CommunityCandidate
  | EventCandidate
  | ActivityCandidate
  | ServiceCandidate

/** @deprecated Prefer DiscoveryCandidate discriminated union; alias for person-shaped results */
export type LegacyPersonDiscovery = PersonCandidate

export interface DiscoveryQuery {
  category: DiscoveryCategory
  intents?: ConnectionIntentId[]
  interests?: string[]
  limit?: number
}

export interface DiscoveryDomainContract {
  search(query: DiscoveryQuery): DomainResult<DiscoveryCandidate[]>
  emptyState(category: DiscoveryCategory): DomainEmptyState
}

export function isPersonCandidate(c: DiscoveryCandidate): c is PersonCandidate {
  return c.kind === "person"
}
export function isCommunityCandidate(c: DiscoveryCandidate): c is CommunityCandidate {
  return c.kind === "community"
}
export function isEventCandidate(c: DiscoveryCandidate): c is EventCandidate {
  return c.kind === "event"
}
export function isActivityCandidate(c: DiscoveryCandidate): c is ActivityCandidate {
  return c.kind === "activity"
}
export function isServiceCandidate(c: DiscoveryCandidate): c is ServiceCandidate {
  return c.kind === "service"
}

export function discoveryEmptyState(category: DiscoveryCategory): DomainEmptyState {
  const labels: Record<DiscoveryCategory, string> = {
    people: "people",
    friends: "friends",
    professionals: "professionals",
    collaborators: "collaborators",
    mentors: "mentors",
    communities: "communities",
    events: "events",
    activities: "activities",
    services: "services",
  }
  const personLike = ["people", "friends", "professionals", "collaborators", "mentors"].includes(
    category
  )
  return {
    title: `No ${labels[category]} yet`,
    description: personLike
      ? "When members with shared interests or goals join GreenHaven, they will appear here. Nothing is fabricated."
      : `No real ${labels[category]} are available from connected sources yet. Empty stays empty — nothing is invented.`,
    primaryAction: personLike
      ? { label: "Update connection goals", tab: "profile" }
      : category === "communities"
        ? { label: "Explore communities", tab: "communities" }
        : { label: "Back to people", tab: "discover" },
  }
}

/** Build deterministic explainable reasons from shared signals */
export function buildExplainableReasons(input: {
  sharedInterests?: string[]
  sharedCommunities?: string[]
  sharedIntents?: ConnectionIntentId[]
  sameLocation?: boolean
  collaborationHint?: string
  /** Object-type specific */
  communityInterestMatch?: string
  eventTopicMatch?: string
  eventInArea?: boolean
  activityInterest?: string
  serviceCapability?: string
}): ExplainableReason[] {
  const reasons: ExplainableReason[] = []
  for (const interest of input.sharedInterests || []) {
    reasons.push({
      code: "shared_interest",
      label: "Shared interest",
      detail: `You both enjoy ${interest}`,
    })
  }
  for (const community of input.sharedCommunities || []) {
    reasons.push({
      code: "shared_community",
      label: "Community",
      detail: `You are both members of ${community}`,
    })
  }
  for (const intent of input.sharedIntents || []) {
    reasons.push({
      code: "shared_intent",
      label: "Connection goal",
      detail: `You both selected ${intent}`,
    })
  }
  if (input.sameLocation) {
    reasons.push({
      code: "location",
      label: "Nearby",
      detail: "You are in the same area",
    })
  }
  if (input.collaborationHint) {
    reasons.push({
      code: "collaboration",
      label: "Collaborate",
      detail: `You may collaborate on ${input.collaborationHint}`,
    })
  }
  if (input.communityInterestMatch) {
    reasons.push({
      code: "community_interest",
      label: "Community fit",
      detail: `This community matches your interest in ${input.communityInterestMatch}`,
    })
  }
  if (input.eventTopicMatch) {
    reasons.push({
      code: "event_topic",
      label: "Event topic",
      detail: `You follow this topic: ${input.eventTopicMatch}`,
    })
  }
  if (input.eventInArea) {
    reasons.push({
      code: "event_area",
      label: "Nearby event",
      detail: "This event is in your area",
    })
  }
  if (input.activityInterest) {
    reasons.push({
      code: "activity_interest",
      label: "Activity",
      detail: `You are interested in ${input.activityInterest}`,
    })
  }
  if (input.serviceCapability) {
    reasons.push({
      code: "service_capability",
      label: "Service",
      detail: `This provider offers ${input.serviceCapability}`,
    })
  }
  return reasons
}
