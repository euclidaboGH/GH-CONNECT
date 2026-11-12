import { NextResponse } from "next/server"
import { parseEventsDiscoveryFilters, projectVisibleCommunityEvents, type RawCommunity, type RawCommunityEvent, type RawCommunityEventRsvp, type RawCommunityMembership } from "@/lib/ecosystem/events-discovery"
import { getEcosystemServiceAccess } from "@/lib/server/ecosystem/service-release"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRest } from "@/lib/server/social/rpc"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie, Authorization" }
const SAFE_USER_ID = /^[a-zA-Z0-9_-]{1,256}$/
const EVENT_COLUMNS = "id,community_id,title,description,starts_at,ends_at,status,location,virtual_link,category"

/**
 * GET /api/ecosystem/events
 * Prepared Events discovery API. It remains inaccessible while the registry
 * marks Events as Coming Soon. Once released, it returns only events from
 * public communities or communities where the viewer has active membership.
 */
export async function GET(request: Request) {
  const access = getEcosystemServiceAccess("events")
  if (!access.allowed) {
    return NextResponse.json({ ok: false, error: access.reason }, { status: 404, headers: NO_STORE })
  }

  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth || !SAFE_USER_ID.test(auth.userId)) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  }
  const rateLimit = await checkDurableRateLimit(`ecosystem-events-read:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rateLimit.ok) {
    return NextResponse.json({ ok: false, error: durableRateLimitCode(rateLimit) }, {
      status: durableRateLimitStatus(rateLimit),
      headers: { ...NO_STORE, "Retry-After": String(rateLimit.retryAfterSec) },
    })
  }

  const filters = parseEventsDiscoveryFilters(new URL(request.url).searchParams)
  if (!filters.ok) return NextResponse.json({ ok: false, error: filters.error }, { status: 400, headers: NO_STORE })
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, error: "EVENTS_DATA_UNAVAILABLE" }, { status: 503, headers: NO_STORE })

  const now = new Date().toISOString()
  const eventQuery = new URLSearchParams({
    select: EVENT_COLUMNS,
    or: `(and(status.eq.scheduled,starts_at.gte.${now}),and(status.eq.ongoing,ends_at.gt.${now}))`,
    order: "starts_at.asc,id.asc",
    limit: String(filters.value.limit),
    offset: String(filters.value.offset),
  })
  const eventResult = await socialRest<RawCommunityEvent[]>(`gh_community_events?${eventQuery.toString()}`)
  if (!eventResult.ok || !Array.isArray(eventResult.data)) {
    return NextResponse.json({ ok: false, error: "EVENTS_DATA_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  }

  const eventRows = eventResult.data
  const eventIds = Array.from(new Set(eventRows.map((row) => typeof row.id === "string" ? row.id : "").filter((id) => /^[a-zA-Z0-9_-]{1,180}$/.test(id))))
  const communityIds = Array.from(new Set(eventRows.map((row) => typeof row.community_id === "string" ? row.community_id : "").filter((id) => /^[a-zA-Z0-9_-]{1,180}$/.test(id))))
  if (!eventIds.length || !communityIds.length) {
    return NextResponse.json({ ok: true, durable: true, events: [], pagination: { limit: filters.value.limit, offset: filters.value.offset, nextOffset: filters.value.offset + eventRows.length, hasMore: eventRows.length >= filters.value.limit } }, { headers: NO_STORE })
  }

  // The service-role read is server-only. Privacy is re-applied here before any
  // event row is returned to the browser; the browser never supplies viewer ID.
  const communityFilter = `in.(${communityIds.join(",")})`
  const eventFilter = `in.(${eventIds.join(",")})`
  const communityQuery = new URLSearchParams({
    select: "id,name,privacy,deleted_at",
    id: communityFilter,
  })
  const membershipQuery = new URLSearchParams({
    select: "community_id",
    community_id: communityFilter,
    gh_user_id: `eq.${auth.userId}`,
    status: "eq.active",
  })
  const rsvpQuery = new URLSearchParams({
    select: "event_id,status",
    event_id: eventFilter,
    user_id: `eq.${auth.userId}`,
  })

  const [communityResult, membershipResult, rsvpResult] = await Promise.all([
    socialRest<RawCommunity[]>(`gh_communities?${communityQuery.toString()}`),
    socialRest<RawCommunityMembership[]>(`gh_community_members?${membershipQuery.toString()}`),
    socialRest<RawCommunityEventRsvp[]>(`gh_community_event_rsvps?${rsvpQuery.toString()}`),
  ])
  if (!communityResult.ok || !Array.isArray(communityResult.data) || !membershipResult.ok || !Array.isArray(membershipResult.data) || !rsvpResult.ok || !Array.isArray(rsvpResult.data)) {
    return NextResponse.json({ ok: false, error: "EVENTS_VISIBILITY_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  }

  const result = projectVisibleCommunityEvents({
    events: eventRows,
    communities: communityResult.data,
    memberships: membershipResult.data,
    rsvps: rsvpResult.data,
    filters: filters.value,
    now: Date.now(),
  })
  return NextResponse.json({
    ok: true,
    durable: true,
    events: result.events,
    pagination: { limit: filters.value.limit, offset: filters.value.offset, nextOffset: result.nextOffset, hasMore: result.hasMore },
  }, { headers: NO_STORE })
}
