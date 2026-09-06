/**
 * Community participation hub — Events, Activities, Resources as first-class surfaces.
 * Non-financial. Does not invent events/resources; only shapes existing authority data.
 */

export type ParticipationItemKind = "event" | "activity" | "resource" | "discussion"

export interface ParticipationEventItem {
  kind: "event"
  id: string
  title: string
  description?: string
  startsAt: number | null
  location?: string
  virtualLink?: string
  attendeeCount: number
  status: "upcoming" | "live" | "past" | "unknown"
}

export interface ParticipationResourceItem {
  kind: "resource"
  id: string
  title: string
  description?: string
  url?: string
  resourceType: string
  order: number
}

export interface ParticipationActivityItem {
  kind: "activity"
  id: string
  title: string
  description?: string
  createdAt: number | null
}

export type ParticipationItem =
  | ParticipationEventItem
  | ParticipationResourceItem
  | ParticipationActivityItem

export interface CommunityParticipationHubModel {
  communityId: string
  upcomingEvents: ParticipationEventItem[]
  pastEvents: ParticipationEventItem[]
  resources: ParticipationResourceItem[]
  activities: ParticipationActivityItem[]
  nextEvent: ParticipationEventItem | null
  resourceCount: number
  emptyEvents: boolean
  emptyResources: boolean
  summaryLine: string
}

function eventTime(e: any): number {
  return Number(e?.startsAt || e?.startAt || e?.date || e?.starts_at || 0) || 0
}

function classifyEvent(e: any, now: number): ParticipationEventItem["status"] {
  const t = eventTime(e)
  if (!t) return "unknown"
  if (t < now - 2 * 60 * 60 * 1000) return "past"
  if (t <= now + 2 * 60 * 60 * 1000 && t >= now - 30 * 60 * 1000) return "live"
  if (t >= now) return "upcoming"
  return "past"
}

export function normalizeEventItem(e: any): ParticipationEventItem {
  const now = Date.now()
  const status = classifyEvent(e, now)
  return {
    kind: "event",
    id: String(e.id || e.eventId || `evt_${Math.random().toString(36).slice(2, 8)}`),
    title: String(e.title || e.name || "Community event"),
    description: e.description ? String(e.description) : undefined,
    startsAt: eventTime(e) || null,
    location: e.location ? String(e.location) : undefined,
    virtualLink: e.virtualLink || e.link || undefined,
    attendeeCount: Array.isArray(e.attendees) ? e.attendees.length : Number(e.attendeeCount) || 0,
    status,
  }
}

export function normalizeResourceItem(r: any, index: number): ParticipationResourceItem {
  return {
    kind: "resource",
    id: String(r.id || r.url || `res_${index}`),
    title: String(r.title || r.name || "Resource"),
    description: r.description ? String(r.description) : undefined,
    url: r.url ? String(r.url) : undefined,
    resourceType: String(r.resourceType || r.type || "link"),
    order: Number(r.order) >= 0 ? Number(r.order) : index,
  }
}

export function buildCommunityParticipationHub(input: {
  communityId: string
  events?: any[]
  resources?: any[]
  /** Board posts that look like activities/challenges */
  boardPosts?: any[]
}): CommunityParticipationHubModel {
  const now = Date.now()
  const events = (input.events || []).map(normalizeEventItem)
  const upcomingEvents = events
    .filter((e) => e.status === "upcoming" || e.status === "live")
    .sort((a, b) => (a.startsAt || 0) - (b.startsAt || 0))
  const pastEvents = events
    .filter((e) => e.status === "past")
    .sort((a, b) => (b.startsAt || 0) - (a.startsAt || 0))
    .slice(0, 10)

  const resources = (input.resources || [])
    .map((r, i) => normalizeResourceItem(r, i))
    .sort((a, b) => a.order - b.order)

  const activities: ParticipationActivityItem[] = (input.boardPosts || [])
    .filter((p) => {
      const t = String(p.type || p.kind || "").toLowerCase()
      const body = String(p.body || p.title || "").toLowerCase()
      return t === "activity" || t === "challenge" || body.includes("activity:") || body.includes("challenge:")
    })
    .slice(0, 8)
    .map((p, i) => ({
      kind: "activity" as const,
      id: String(p.id || `act_${i}`),
      title: String(p.title || p.body || "Activity").slice(0, 120),
      description: p.body && p.title ? String(p.body).slice(0, 200) : undefined,
      createdAt: Number(p.createdAt) || null,
    }))

  const nextEvent = upcomingEvents[0] || null
  const parts: string[] = []
  if (upcomingEvents.length) parts.push(`${upcomingEvents.length} upcoming event${upcomingEvents.length === 1 ? "" : "s"}`)
  if (resources.length) parts.push(`${resources.length} resource${resources.length === 1 ? "" : "s"}`)
  if (activities.length) parts.push(`${activities.length} activity post${activities.length === 1 ? "" : "s"}`)
  if (!parts.length) parts.push("No scheduled events or pinned resources yet")

  return {
    communityId: input.communityId,
    upcomingEvents,
    pastEvents,
    resources,
    activities,
    nextEvent,
    resourceCount: resources.length,
    emptyEvents: upcomingEvents.length === 0,
    emptyResources: resources.length === 0,
    summaryLine: parts.join(" · "),
  }
}

export function formatEventWhen(startsAt: number | null): string {
  if (!startsAt) return "Date TBA"
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(startsAt))
  } catch {
    return new Date(startsAt).toLocaleString()
  }
}
