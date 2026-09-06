/**
 * Discriminated Discovery object model (Prompt #38).
 * People are not used as stand-ins for communities/events/services.
 */

import type { ConnectionIntentId } from "@/lib/connection-intents"
import type { ExplainableReason } from "./types"
import type { DiscoveryCategory } from "./discovery"

export type DiscoveryObjectKind =
  | "person"
  | "community"
  | "event"
  | "activity"
  | "service"

export interface DiscoveryObjectBase {
  id: string
  kind: DiscoveryObjectKind
  /** Maps to discovery category filter */
  category: DiscoveryCategory
  displayName: string
  subtitle?: string
  reasons: ExplainableReason[]
  /** Internal ranking only — never shown as % */
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
  description?: string
  memberCount?: number
  privacy?: string
  tags?: string[]
  region?: string
  isMember?: boolean
  coverImage?: string
}

export interface EventCandidate extends DiscoveryObjectBase {
  kind: "event"
  communityId?: string
  communityName?: string
  startsAt?: string
  endsAt?: string
  locationLabel?: string | null
  isOnline?: boolean
  organizerId?: string
  rsvpCount?: number
}

export interface ActivityCandidate extends DiscoveryObjectBase {
  kind: "activity"
  activityType?: string
  communityId?: string
  communityName?: string
  organizerName?: string
  status?: "open" | "scheduled" | "closed" | string
  startsAt?: string
}

export interface ServiceCandidate extends DiscoveryObjectBase {
  kind: "service"
  providerId?: string
  providerName?: string
  serviceCategory?: string
  capability?: string
  priceLabel?: string
  currency?: string
}

export type TypedDiscoveryCandidate =
  | PersonCandidate
  | CommunityCandidate
  | EventCandidate
  | ActivityCandidate
  | ServiceCandidate

/** Category → expected object kind */
export function kindForCategory(category: DiscoveryCategory): DiscoveryObjectKind {
  switch (category) {
    case "communities":
      return "community"
    case "events":
      return "event"
    case "activities":
      return "activity"
    case "services":
      return "service"
    case "people":
    case "friends":
    case "professionals":
    case "collaborators":
    case "mentors":
    default:
      return "person"
  }
}

export function isPersonCandidate(c: TypedDiscoveryCandidate): c is PersonCandidate {
  return c.kind === "person"
}
export function isCommunityCandidate(c: TypedDiscoveryCandidate): c is CommunityCandidate {
  return c.kind === "community"
}
export function isEventCandidate(c: TypedDiscoveryCandidate): c is EventCandidate {
  return c.kind === "event"
}
export function isActivityCandidate(c: TypedDiscoveryCandidate): c is ActivityCandidate {
  return c.kind === "activity"
}
export function isServiceCandidate(c: TypedDiscoveryCandidate): c is ServiceCandidate {
  return c.kind === "service"
}
