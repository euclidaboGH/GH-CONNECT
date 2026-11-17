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
  const raw = e?.startsAt ?? e?.startAt ?? e?.date ?? e?.starts_at
  if (raw instanceof Date) {
    const timestamp = raw.getTime()
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
  }
  if (typeof raw === "number" || (typeof raw === "string" && /^\d+(?:\.\d+)?$/.test(raw.trim()))) {
    const numeric = Number(raw)
    if (!Number.isFinite(numeric) || numeric <= 0) return 0
    // Accept Unix seconds as well as JavaScript milliseconds.
    const timestamp = numeric < 100_000_000_000 ? numeric * 1000 : numeric
    return timestamp <= 8_640_000_000_000_000 ? timestamp : 0
  }
  if (typeof raw === "string" && raw.trim()) {
    const timestamp = Date.parse(raw.trim())
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
  }
  return 0
}

function classifyEvent(e: any, now: number): ParticipationEventItem["status"] {
  const t = eventTime(e)
  if (!t) return "unknown"
  if (t < now - 2 * 60 * 60 * 1000) return "past"
  if (t <= now + 2 * 60 * 60 * 1000 && t >= now - 30 * 60 * 1000) return "live"
  if (t >= now) return "upcoming"
  return "past"
}

export function normalizeEventItem(e: any, index = 0): ParticipationEventItem {
  const source = e && typeof e === "object" ? e : {}
  const now = Date.now()
  const status = classifyEvent(source, now)
  const title = String(source.title || source.name || "Community event").trim().slice(0, 160) || "Community event"
  const startsAt = eventTime(source)
  const location = source.location ? String(source.location).trim().slice(0, 180) : ""
  const virtualLink = safeCommunityResourceUrl(source.virtualLink || source.link)
  const rawAttendeeCount = Array.isArray(source.attendees) ? source.attendees.length : Number(source.attendeeCount)
  const attendeeCount = Number.isFinite(rawAttendeeCount) ? Math.max(0, rawAttendeeCount) : 0
  // Legacy rows without a provider ID still need stable React keys; rendering
  // must not manufacture a new event identity.
  const fallbackId = `evt_${index}_${startsAt}_${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`
  return {
    kind: "event",
    id: String(source.id || source.eventId || fallbackId),
    title,
    description: source.description ? String(source.description).slice(0, 1000) : undefined,
    startsAt: startsAt || null,
    location: location || undefined,
    virtualLink,
    attendeeCount,
    status,
  }
}

export function safeCommunityResourceUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const value = raw.trim()
  if (!value || value.length > 2048 || /[\u0000-\u001f\\]/.test(value) || value.startsWith("//")) return undefined
  try {
    const parsed = new URL(value, "https://greenhaven.invalid")
    if (parsed.protocol !== "https:") return undefined
    if (parsed.username || parsed.password) return undefined
    if (parsed.origin !== "https://greenhaven.invalid" && !/^https:\/\//i.test(value)) return undefined
    return value
  } catch {
    return undefined
  }
}

export function normalizeResourceItem(r: any, index: number): ParticipationResourceItem {
  const source = r && typeof r === "object" ? r : {}
  return {
    kind: "resource",
    id: String(source.id || source.url || `res_${index}`),
    title: String(source.title || source.name || "Resource").slice(0, 160),
    description: source.description ? String(source.description).slice(0, 1000) : undefined,
    url: safeCommunityResourceUrl(source.url),
    resourceType: String(source.resourceType || source.type || "link").slice(0, 32),
    order: Number.isFinite(Number(source.order)) && Number(source.order) >= 0 ? Number(source.order) : index,
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
  const events = (input.events || []).map((event, index) => normalizeEventItem(event, index))
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
