/** Strict, side-effect-free event payload validation. No persistence or RSVP actions. */
import type { EventLifecycle, EventRecord, EventVisibility } from "@/lib/domains/contracts/events"

export type EventParseResult =
  | { ok: true; data: EventRecord }
  | { ok: false; code: "INVALID_EVENT" | "INVALID_DATE_RANGE" | "INVALID_LOCATION" }

const MAX_TITLE = 120
const MAX_DESCRIPTION = 4_000
const MAX_LOCATION = 240
const MAX_ID = 128
const MAX_CAPACITY = 100_000
const LIFECYCLES = new Set<EventLifecycle>(["draft", "published", "cancelled", "completed"])
const VISIBILITIES = new Set<EventVisibility>(["public", "community", "private"])

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const clean = value.trim()
  return clean.length > 0 && clean.length <= max ? clean : null
}

function optionalString(value: unknown, max: number): string | undefined {
  if (value == null || value === "") return undefined
  return boundedString(value, max) ?? undefined
}

function validIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function safeHttpsUrl(value: unknown): string | undefined {
  const raw = boundedString(value, 2_048)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || url.username || url.password) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

export function parseEventRecord(input: unknown): EventParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "INVALID_EVENT" }
  }
  const row = input as Record<string, unknown>
  const id = boundedString(row.id, MAX_ID)
  const organizerId = boundedString(row.organizerId, MAX_ID)
  const title = boundedString(row.title, MAX_TITLE)
  const description = typeof row.description === "string" && row.description.length <= MAX_DESCRIPTION
    ? row.description.trim()
    : null
  const startsAt = validIsoDate(row.startsAt)
  const endsAt = validIsoDate(row.endsAt)
  const createdAt = validIsoDate(row.createdAt)
  const updatedAt = validIsoDate(row.updatedAt)
  const timezone = boundedString(row.timezone, 80)
  const communityId = row.communityId == null || row.communityId === ""
    ? undefined
    : boundedString(row.communityId, MAX_ID)
  let timezoneValid = false
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0)
      timezoneValid = true
    } catch {
      timezoneValid = false
    }
  }
  const visibility = row.visibility as EventVisibility
  const lifecycle = row.lifecycle as EventLifecycle

  if (!id || !organizerId || !title || description === null || !startsAt || !endsAt ||
      !createdAt || !updatedAt || !timezone || !timezoneValid ||
      (row.communityId != null && row.communityId !== "" && !communityId) || !VISIBILITIES.has(visibility) ||
      !LIFECYCLES.has(lifecycle) || typeof row.isOnline !== "boolean") {
    return { ok: false, code: "INVALID_EVENT" }
  }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    return { ok: false, code: "INVALID_DATE_RANGE" }
  }

  const locationLabel = optionalString(row.locationLabel, MAX_LOCATION)
  const meetingUrl = safeHttpsUrl(row.meetingUrl)
  if (!row.isOnline && !locationLabel) return { ok: false, code: "INVALID_LOCATION" }
  if (row.isOnline && row.meetingUrl != null && row.meetingUrl !== "" && !meetingUrl) {
    return { ok: false, code: "INVALID_LOCATION" }
  }
  if (row.capacity != null && (!Number.isSafeInteger(row.capacity) || Number(row.capacity) < 1 || Number(row.capacity) > MAX_CAPACITY)) {
    return { ok: false, code: "INVALID_EVENT" }
  }

  return {
    ok: true,
    data: {
      id,
      organizerId,
      ...(communityId ? { communityId } : {}),
      title,
      description,
      startsAt,
      endsAt,
      timezone,
      visibility,
      lifecycle,
      isOnline: row.isOnline,
      ...(locationLabel ? { locationLabel } : {}),
      ...(meetingUrl ? { meetingUrl } : {}),
      ...(row.capacity != null ? { capacity: Number(row.capacity) } : {}),
      createdAt,
      updatedAt,
    },
  }
}
