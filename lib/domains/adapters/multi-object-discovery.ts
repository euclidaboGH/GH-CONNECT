/**
 * Multi-object discovery — real sources only.
 * People → session candidates
 * Communities / Events / Activities → community registry (no seed inject in prod)
 * Services → marketplace listings kind=service (session store)
 * Missing source → honest empty + documented seam
 */

import type {
  DiscoveryCandidate,
  DiscoveryCategory,
  DiscoveryQuery,
  CommunityCandidate,
  EventCandidate,
  ActivityCandidate,
  ServiceCandidate,
} from "@/lib/domains/contracts/discovery"
import { buildExplainableReasons, discoveryEmptyState } from "@/lib/domains/contracts/discovery"
import type { DomainResult } from "@/lib/domains/contracts/types"
import { adaptDiscoveryList, type RawDiscoveryCandidate } from "@/lib/domains/adapters/discovery-adapter"
import type { ViewerDiscoveryContext } from "@/lib/domains/adapters/discovery-adapter"
import { loadCommunities, type GHCCommunity, type CommunityEvent } from "@/lib/domains/community-registry"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"

const PERSON_CATEGORIES: DiscoveryCategory[] = [
  "people",
  "friends",
  "professionals",
  "collaborators",
  "mentors",
]

/** Documented seams when a category has no durable backend yet */
export const DISCOVERY_SOURCE_STATUS = {
  people: { source: "session_candidates", ready: true },
  friends: { source: "session_candidates+graph", ready: true },
  professionals: { source: "session_candidates+intents", ready: true },
  collaborators: { source: "session_candidates+intents", ready: true },
  mentors: { source: "session_candidates+intents", ready: true },
  communities: { source: "community_registry", ready: true },
  events: { source: "community_registry.events", ready: true },
  activities: { source: "community_registry.board+events", ready: true },
  services: { source: "marketplace_listings_kind_service", ready: true },
} as const

function sharedInterestHit(tags: string[], viewerInterests: string[]): string | undefined {
  const v = viewerInterests.map((x) => x.toLowerCase())
  for (const t of tags) {
    if (v.some((i) => i === t.toLowerCase() || t.toLowerCase().includes(i) || i.includes(t.toLowerCase()))) {
      return t
    }
  }
  return undefined
}

function mapCommunity(
  c: GHCCommunity,
  viewer: ViewerDiscoveryContext,
  category: DiscoveryCategory
): CommunityCandidate {
  const tags = [...(c.tags || []), c.category, c.purpose].filter(Boolean).map(String)
  const hit = sharedInterestHit(tags, viewer.interests || [])
  const reasons = buildExplainableReasons({
    communityInterestMatch: hit,
    sharedInterests: hit ? [hit] : undefined,
  })
  if (!reasons.length && c.region && viewer.city) {
    reasons.push({
      code: "community_region",
      label: "Region",
      detail: `Active in ${c.region}`,
    })
  }
  return {
    id: c.id,
    kind: "community",
    category,
    displayName: c.name,
    subtitle: c.purpose || c.description?.slice(0, 120),
    purpose: c.purpose,
    memberCount: Array.isArray(c.members) ? c.members.length : 0,
    privacy: c.privacy,
    tags: c.tags,
    region: c.region,
    coverImage: c.coverImage,
    reasons,
    rankScore:
      (hit ? 12 : 0) +
      (c.members?.length || 0) * 0.02 +
      (String((c as any).lifecycle || "active") === "active" ? 4 : 0) +
      (String((c as any).lifecycle || "") === "quiet" ? -2 : 0) +
      (Array.isArray((c as any).events) && (c as any).events.length ? 3 : 0),
  }
}

function mapEventSafe(
  e: CommunityEvent,
  community: GHCCommunity,
  viewer: ViewerDiscoveryContext
): EventCandidate {
  const tags = [...(community.tags || []), community.category, e.title].map(String)
  const hit = sharedInterestHit(tags, viewer.interests || [])
  const inArea = Boolean(
    viewer.city &&
      e.location &&
      String(e.location).toLowerCase().includes(String(viewer.city).toLowerCase())
  )
  const reasons = buildExplainableReasons({
    eventTopicMatch: hit,
    eventInArea: inArea || undefined,
  })
  return {
    id: e.id,
    kind: "event",
    category: "events",
    displayName: e.title,
    subtitle: e.description?.slice(0, 120) || community.name,
    startsAt: e.startsAt ? new Date(e.startsAt).toISOString() : undefined,
    endsAt: e.endsAt ? new Date(e.endsAt).toISOString() : undefined,
    locationLabel: e.location || (e.isOnline ? "Online" : community.region) || null,
    isOnline: e.isOnline,
    communityId: community.id,
    communityName: community.name,
    organizerId: e.createdBy,
    reasons,
    rankScore: (hit ? 8 : 0) + (inArea ? 5 : 0),
  }
}

function mapActivityFromBoard(
  community: GHCCommunity,
  viewer: ViewerDiscoveryContext
): ActivityCandidate[] {
  const out: ActivityCandidate[] = []
  for (const post of community.boardPosts || []) {
    if (post.kind !== "question" && post.kind !== "resource" && post.kind !== "poll") continue
    const hit = sharedInterestHit(
      [post.body, community.category, ...(community.tags || [])].map(String),
      viewer.interests || []
    )
    const reasons = buildExplainableReasons({
      activityInterest: hit || (post.kind === "poll" ? "a community poll" : undefined),
    })
    out.push({
      id: post.id,
      kind: "activity",
      category: "activities",
      displayName: post.body.slice(0, 80) || `${post.kind} in ${community.name}`,
      subtitle: community.name,
      activityType: post.kind,
      status: post.pinned ? "pinned" : "open",
      communityId: community.id,
      communityName: community.name,
      organizerId: post.authorId,
      organizerName: post.authorName,
      reasons,
      rankScore: hit ? 6 : 2,
    })
  }
  return out
}

/** Marketplace service listings — read-only; no payment from discovery */
export function loadServiceListingsSafe(): Array<Record<string, unknown>> {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem("ghc_marketplace_listings_v1")
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (l) =>
        l &&
        (l.kind === "service" || l.kind === "opportunity") &&
        l.status === "active" &&
        (!String(l.id || "").startsWith("demo-") || isDemoDataAllowed())
    )
  } catch {
    return []
  }
}

function mapService(raw: Record<string, unknown>, viewer: ViewerDiscoveryContext): ServiceCandidate {
  const tags = [...(Array.isArray(raw.tags) ? raw.tags : []), String(raw.category || "")].map(String)
  const hit = sharedInterestHit(tags, viewer.interests || [])
  const title = String(raw.title || "Service")
  const reasons = buildExplainableReasons({
    serviceCapability: hit || title,
  })
  const price =
    typeof raw.price === "number"
      ? `${raw.price} ${String(raw.currency || "GHC")}`
      : undefined
  return {
    id: String(raw.id),
    kind: "service",
    category: "services",
    displayName: title,
    subtitle: String(raw.description || "").slice(0, 120),
    providerId: String(raw.sellerId || ""),
    serviceCategory: String(raw.category || ""),
    tags: tags.filter(Boolean),
    locationLabel: raw.location ? String(raw.location) : null,
    priceLabel: price,
    reasons,
    rankScore: hit ? 7 : 1,
  }
}

export function searchDiscoveryObjects(
  query: DiscoveryQuery,
  viewer: ViewerDiscoveryContext,
  peopleRaw: RawDiscoveryCandidate[] = []
): DomainResult<DiscoveryCandidate[]> {
  const limit = query.limit ?? 36
  const category = query.category

  if (PERSON_CATEGORIES.includes(category)) {
    return adaptDiscoveryList(peopleRaw, viewer, query)
  }

  const communities = loadCommunities().filter((c) => {
    if (isDemoDataAllowed()) return true
    return !String(c.id).startsWith("demo-community-")
  })

  if (category === "communities") {
    const list = communities
      .filter((c) => {
        const priv = String(c.privacy || "public").toLowerCase()
        const life = String((c as any).lifecycle || "active").toLowerCase()
        if (life === "draft" || life === "archived") return false
        // Discoverable only — private/invite-only stay out of search/discovery
        return priv !== "private" && priv !== "invite-only" && priv !== "secret"
      })
      .map((c) => mapCommunity(c, viewer, category))
      .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
      .slice(0, limit)
    return list.length
      ? { ok: true, data: list, source: "session" }
      : { ok: true, data: [], source: "empty" }
  }

  if (category === "events") {
    const list: EventCandidate[] = []
    for (const c of communities) {
      for (const e of c.events || []) {
        list.push(mapEventSafe(e, c, viewer))
      }
    }
    list.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
    const sliced = list.slice(0, limit)
    return sliced.length
      ? { ok: true, data: sliced, source: "session" }
      : { ok: true, data: [], source: "empty" }
  }

  if (category === "activities") {
    const list: ActivityCandidate[] = []
    for (const c of communities) {
      list.push(...mapActivityFromBoard(c, viewer))
    }
    list.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
    const sliced = list.slice(0, limit)
    return sliced.length
      ? { ok: true, data: sliced, source: "session" }
      : { ok: true, data: [], source: "empty" }
  }

  if (category === "services") {
    const list = loadServiceListingsSafe()
      .map((l) => mapService(l, viewer))
      .sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))
      .slice(0, limit)
    return list.length
      ? { ok: true, data: list, source: "session" }
      : { ok: true, data: [], source: "empty" }
  }

  return { ok: true, data: [], source: "empty" }
}

export { discoveryEmptyState }
