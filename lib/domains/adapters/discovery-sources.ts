/**
 * Real discovery data sources — adapters over existing session stores.
 * Does not invent records. Empty categories stay empty.
 */

import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { loadCommunities, type GHCCommunity, type CommunityEvent } from "@/lib/domains/community-registry"
import { buildExplainableReasons } from "@/lib/domains/contracts/discovery"
import type { DiscoveryCategory } from "@/lib/domains/contracts/discovery"
import type {
  TypedDiscoveryCandidate,
  CommunityCandidate,
  EventCandidate,
  ActivityCandidate,
  ServiceCandidate,
} from "@/lib/domains/contracts/discovery-objects"
import type { ConnectionIntentId } from "@/lib/connection-intents"
import type { DomainResult } from "@/lib/domains/contracts/types"

export interface DiscoveryViewerContext {
  userId: string
  interests?: string[]
  intents?: ConnectionIntentId[]
  city?: string
  communityIds?: string[]
}

export type DiscoverySourceId =
  | "session_candidates"
  | "community_registry"
  | "community_events"
  | "community_board_activity"
  | "marketplace_listings"
  | "unavailable"

export interface DiscoverySourceStatus {
  source: DiscoverySourceId
  available: boolean
  note: string
}

/** Documented source map for operators / Prompt reports */
export const DISCOVERY_SOURCE_STATUS: Record<
  "people" | "communities" | "events" | "activities" | "services",
  DiscoverySourceStatus
> = {
  people: {
    source: "session_candidates",
    available: true,
    note: "useGHCDiscovery candidates via discovery-adapter",
  },
  communities: {
    source: "community_registry",
    available: true,
    note: "loadCommunities() — production strips demo-community-*",
  },
  events: {
    source: "community_events",
    available: true,
    note: "GHCCommunity.events from registry; empty if none scheduled",
  },
  activities: {
    source: "community_board_activity",
    available: true,
    note: "Board posts + open events as participation activities; empty if none",
  },
  services: {
    source: "marketplace_listings",
    available: true,
    note: "Marketplace listings when present in session storage; empty if none",
  },
}

function sharedInterestReasons(
  tags: string[],
  viewer: DiscoveryViewerContext,
  forKind: "community" | "event" | "activity" | "service"
) {
  const shared = tags.filter((t) =>
    (viewer.interests || []).some((i) => String(i).toLowerCase() === String(t).toLowerCase())
  )
  const reasons = buildExplainableReasons({
    sharedInterests: shared.slice(0, 3),
    sharedIntents: (viewer.intents || []).filter((i) =>
      ["communities", "events", "volunteering", "business", "collaboration"].includes(i)
    ).slice(0, 2),
  })
  if (!reasons.length && shared.length) {
    /* already covered */
  }
  if (!reasons.length && forKind === "community" && (viewer.intents || []).includes("communities")) {
    reasons.push({
      code: "intent_community",
      label: "Goals",
      detail: "Matches your interest in communities",
    })
  }
  if (!reasons.length && forKind === "event" && viewer.city) {
    reasons.push({
      code: "topic_area",
      label: "Context",
      detail: "Event may be relevant based on your activity and area",
    })
  }
  return reasons
}

export function loadCommunityCandidates(
  viewer: DiscoveryViewerContext,
  limit = 36
): DomainResult<CommunityCandidate[]> {
  const list = loadCommunities().filter((c) => {
    if (!isDemoDataAllowed() && (c.isSample || String(c.id).startsWith("demo-"))) return false
    return true
  })
  const out: CommunityCandidate[] = []
  for (const c of list) {
    if (out.length >= limit) break
    const tags = [...(c.tags || []), c.category].filter(Boolean)
    const reasons = sharedInterestReasons(tags, viewer, "community")
    if (viewer.communityIds?.length && viewer.communityIds.includes(c.id)) {
      reasons.unshift({
        code: "already_member",
        label: "Your community",
        detail: "You already belong here",
      })
    } else if (
      viewer.city &&
      c.region &&
      String(c.region).toLowerCase().includes(String(viewer.city).toLowerCase())
    ) {
      reasons.push({
        code: "shared_region",
        label: "Near you",
        detail: `Active around ${c.region}`,
      })
    }
    if (!reasons.length && c.purpose) {
      reasons.push({
        code: "community_purpose",
        label: "Community",
        detail: `Focused on ${String(c.purpose).slice(0, 80)}`,
      })
    }
    if (!reasons.length) {
      reasons.push({
        code: "community_discoverable",
        label: "Community",
        detail: "Open community on GreenHaven",
      })
    }
    out.push({
      id: c.id,
      kind: "community",
      category: "communities",
      displayName: c.name,
      subtitle: c.purpose || c.description?.slice(0, 120),
      purpose: c.purpose,
      description: c.description,
      memberCount: c.members?.length || 0,
      privacy: c.privacy,
      tags,
      region: c.region,
      isMember: (c.members || []).includes(viewer.userId) || c.createdBy === viewer.userId,
      coverImage: c.coverImage,
      reasons,
      rankScore: (c.members?.length || 0) + (reasons.length * 2),
    })
  }
  out.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
  return out.length
    ? { ok: true, data: out, source: "session" }
    : { ok: true, data: [], source: "empty" }
}

export function loadEventCandidates(
  viewer: DiscoveryViewerContext,
  limit = 36
): DomainResult<EventCandidate[]> {
  const communities = loadCommunities().filter(
    (c) => isDemoDataAllowed() || !(c.isSample || String(c.id).startsWith("demo-"))
  )
  const out: EventCandidate[] = []
  const now = Date.now()
  for (const c of communities) {
    for (const ev of c.events || []) {
      if (out.length >= limit) break
      if (ev.endsAt && ev.endsAt < now) continue
      const tags = [...(c.tags || []), c.category, ev.title]
      const reasons = sharedInterestReasons(tags, viewer, "event")
      if (!reasons.length) {
        reasons.push({
          code: "event_upcoming",
          label: "Event",
          detail: `Upcoming in ${c.name}`,
        })
      }
      out.push({
        id: ev.id,
        kind: "event",
        category: "events",
        displayName: ev.title,
        subtitle: ev.description?.slice(0, 120) || c.name,
        communityId: c.id,
        communityName: c.name,
        startsAt: ev.startsAt ? new Date(ev.startsAt).toISOString() : undefined,
        endsAt: ev.endsAt ? new Date(ev.endsAt).toISOString() : undefined,
        locationLabel: ev.location || (ev.isOnline ? "Online" : c.region) || null,
        isOnline: ev.isOnline,
        organizerId: ev.createdBy,
        rsvpCount: ev.rsvpYes?.length || 0,
        reasons,
        rankScore: (ev.startsAt || 0) / 1e11 + (ev.rsvpYes?.length || 0),
      })
    }
  }
  out.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
  return out.length
    ? { ok: true, data: out, source: "session" }
    : { ok: true, data: [], source: "empty" }
}

export function loadActivityCandidates(
  viewer: DiscoveryViewerContext,
  limit = 36
): DomainResult<ActivityCandidate[]> {
  const communities = loadCommunities().filter(
    (c) => isDemoDataAllowed() || !(c.isSample || String(c.id).startsWith("demo-"))
  )
  const out: ActivityCandidate[] = []
  for (const c of communities) {
    // Board participation as activities
    for (const post of (c.boardPosts || []).slice(0, 5)) {
      if (out.length >= limit) break
      if (post.kind === "resource") continue
      const tags = [...(c.tags || []), post.kind]
      const reasons = sharedInterestReasons(tags, viewer, "activity")
      if (!reasons.length) {
        reasons.push({
          code: "activity_board",
          label: "Activity",
          detail: `Active discussion in ${c.name}`,
        })
      }
      out.push({
        id: `activity_post_${post.id}`,
        kind: "activity",
        category: "activities",
        displayName: post.body.slice(0, 80) || `${post.kind} in ${c.name}`,
        subtitle: c.name,
        activityType: post.kind,
        communityId: c.id,
        communityName: c.name,
        organizerName: post.authorName,
        status: "open",
        startsAt: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
        reasons,
        rankScore: post.createdAt || 0,
      })
    }
  }
  out.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
  return out.length
    ? { ok: true, data: out.slice(0, limit), source: "session" }
    : { ok: true, data: [], source: "empty" }
}

/** Marketplace listings as services — read-only; empty if none */
export function loadServiceCandidates(
  viewer: DiscoveryViewerContext,
  limit = 36
): DomainResult<ServiceCandidate[]> {
  let listings: Array<Record<string, unknown>> = []
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("ghc_marketplace_listings_v1")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) listings = parsed
      }
    }
  } catch {
    listings = []
  }
  const out: ServiceCandidate[] = []
  for (const l of listings) {
    if (out.length >= limit) break
    if (String(l.status || "") === "removed") continue
    const title = String(l.title || l.name || "Service")
    const category = String(l.category || l.serviceCategory || "Services")
    const tags = [category, String(l.description || "")].filter(Boolean)
    const reasons = sharedInterestReasons(tags, viewer, "service")
    if (!reasons.length) {
      reasons.push({
        code: "service_offer",
        label: "Service",
        detail: "Listed capability on GreenHaven Marketplace",
      })
    }
    out.push({
      id: String(l.id || ""),
      kind: "service",
      category: "services",
      displayName: title,
      subtitle: String(l.description || "").slice(0, 120) || undefined,
      providerId: String(l.sellerId || l.providerId || ""),
      providerName: String(l.sellerName || l.providerName || "Provider"),
      serviceCategory: category,
      capability: String(l.description || "").slice(0, 80),
      priceLabel:
        typeof l.price === "number"
          ? `${l.price} ${l.currency || "GHC"}`
          : undefined,
      currency: String(l.currency || "GHC"),
      reasons,
      rankScore: Number(l.updatedAt || l.createdAt || 0),
    })
  }
  return out.length
    ? { ok: true, data: out, source: "session" }
    : { ok: true, data: [], source: "empty" }
}

export function loadTypedDiscovery(
  category: DiscoveryCategory,
  viewer: DiscoveryViewerContext,
  limit = 36
): DomainResult<TypedDiscoveryCandidate[]> {
  switch (category) {
    case "communities":
      return loadCommunityCandidates(viewer, limit)
    case "events":
      return loadEventCandidates(viewer, limit)
    case "activities":
      return loadActivityCandidates(viewer, limit)
    case "services":
      return loadServiceCandidates(viewer, limit)
    default:
      // Person-shaped categories handled by discovery-adapter
      return { ok: true, data: [], source: "empty" }
  }
}
