export const COMMUNITY_EVENT_CATEGORIES = ["meeting", "social", "workshop", "discussion", "celebration"] as const
export type CommunityEventCategory = (typeof COMMUNITY_EVENT_CATEGORIES)[number]
export type CommunityEventRsvp = "going" | "maybe" | "declined"

export type RawCommunityEvent = {
  id?: unknown
  community_id?: unknown
  title?: unknown
  description?: unknown
  starts_at?: unknown
  ends_at?: unknown
  status?: unknown
  location?: unknown
  virtual_link?: unknown
  category?: unknown
}
export type RawCommunity = { id?: unknown; name?: unknown; privacy?: unknown; deleted_at?: unknown }
export type RawCommunityMembership = { community_id?: unknown }
export type RawCommunityEventRsvp = { event_id?: unknown; status?: unknown }

export type EventsDiscoveryFilters = {
  query: string
  category: CommunityEventCategory | null
  limit: number
  offset: number
}
export type CommunityEventCard = {
  id: string
  communityId: string
  communityName: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  status: "scheduled" | "ongoing"
  location: string | null
  virtualLink: string | null
  category: CommunityEventCategory
  viewerRsvpStatus: CommunityEventRsvp | null
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const SAFE_ID = /^[a-zA-Z0-9_-]{1,180}$/

export function parseEventsDiscoveryFilters(params: URLSearchParams):
  | { ok: true; value: EventsDiscoveryFilters }
  | { ok: false; error: "INVALID_LIMIT" | "INVALID_OFFSET" | "INVALID_QUERY" | "INVALID_CATEGORY" } {
  const rawLimit = params.get("limit") ?? "30"
  const rawOffset = params.get("offset") ?? "0"
  if (!/^\d{1,2}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50) return { ok: false, error: "INVALID_LIMIT" }
  if (!/^\d{1,5}$/.test(rawOffset) || Number(rawOffset) > 10_000) return { ok: false, error: "INVALID_OFFSET" }
  const query = (params.get("q") ?? "").normalize("NFKC").trim()
  if (query.length > 120 || CONTROL_CHARS.test(query)) return { ok: false, error: "INVALID_QUERY" }
  const rawCategory = (params.get("category") ?? "").trim()
  if (rawCategory && !(COMMUNITY_EVENT_CATEGORIES as readonly string[]).includes(rawCategory)) return { ok: false, error: "INVALID_CATEGORY" }
  return { ok: true, value: { query, category: rawCategory ? rawCategory as CommunityEventCategory : null, limit: Number(rawLimit), offset: Number(rawOffset) } }
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const normalized = value.normalize("NFKC").trim()
  if (normalized.length > max || CONTROL_CHARS.test(normalized)) return null
  return normalized
}

function safeHttpsLink(value: unknown): string | null {
  if (value == null || value === "") return null
  const text = boundedText(value, 2048)
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== "https:" || url.username || url.password) return null
    return url.toString()
  } catch { return null }
}

function isRsvp(value: unknown): value is CommunityEventRsvp {
  return value === "going" || value === "maybe" || value === "declined"
}

/** Projects only upcoming events the authenticated viewer may see. Private and invite-only communities require active membership. */
export function projectVisibleCommunityEvents(input: {
  events: RawCommunityEvent[]
  communities: RawCommunity[]
  memberships: RawCommunityMembership[]
  rsvps: RawCommunityEventRsvp[]
  filters: EventsDiscoveryFilters
  now?: number
}): { events: CommunityEventCard[]; rawCount: number; hasMore: boolean; nextOffset: number } {
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now()
  const communities = new Map<string, RawCommunity>()
  for (const community of input.communities) {
    const id = typeof community.id === "string" ? community.id : ""
    if (SAFE_ID.test(id)) communities.set(id, community)
  }
  const activeMemberships = new Set(input.memberships.map((row) => typeof row.community_id === "string" ? row.community_id : "").filter((id) => SAFE_ID.test(id)))
  const rsvpByEvent = new Map<string, CommunityEventRsvp>()
  for (const row of input.rsvps) {
    const id = typeof row.event_id === "string" ? row.event_id : ""
    if (SAFE_ID.test(id) && isRsvp(row.status)) rsvpByEvent.set(id, row.status)
  }

  const projected: CommunityEventCard[] = []
  for (const row of input.events) {
    const id = typeof row.id === "string" ? row.id : ""
    const communityId = typeof row.community_id === "string" ? row.community_id : ""
    if (!SAFE_ID.test(id) || !SAFE_ID.test(communityId)) continue
    const community = communities.get(communityId)
    if (!community || community.deleted_at != null) continue
    if (community.privacy !== "public" && !activeMemberships.has(communityId)) continue
    if (row.status !== "scheduled" && row.status !== "ongoing") continue
    const startsAt = typeof row.starts_at === "string" ? Date.parse(row.starts_at) : Number.NaN
    const endsAt = typeof row.ends_at === "string" ? Date.parse(row.ends_at) : Number.NaN
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt || endsAt <= now) continue
    if (row.status === "scheduled" && startsAt < now) continue
    const title = boundedText(row.title, 120)
    const description = boundedText(row.description, 5000)
    const communityName = boundedText(community.name, 80)
    if (!title || description == null || !communityName) continue
    if (!(COMMUNITY_EVENT_CATEGORIES as readonly unknown[]).includes(row.category)) continue
    const category = row.category as CommunityEventCategory
    if (input.filters.category && category !== input.filters.category) continue
    if (input.filters.query) {
      const needle = input.filters.query.toLocaleLowerCase()
      if (!`${title} ${description} ${communityName}`.toLocaleLowerCase().includes(needle)) continue
    }
    const location = boundedText(row.location, 300)
    projected.push({
      id, communityId, communityName, title, description,
      startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(),
      status: row.status, location: location || null, virtualLink: safeHttpsLink(row.virtual_link), category,
      viewerRsvpStatus: rsvpByEvent.get(id) ?? null,
    })
  }
  projected.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
  return { events: projected, rawCount: input.events.length, hasMore: input.events.length >= input.filters.limit, nextOffset: input.filters.offset + input.events.length }
}
