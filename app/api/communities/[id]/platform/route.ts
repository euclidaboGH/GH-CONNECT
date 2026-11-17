import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableReadResponse, nonDurableWriteResponse } from "@/lib/server/production-guard"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"
import { sanitizeCommunityId } from "@/lib/server/community/community-integrity"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie, Authorization" }

function boundedText(value: unknown, max: number, required = false): string | null {
  if (typeof value !== "string") return required ? null : ""
  const text = value.normalize("NFKC").trim()
  if (text.length > max || (required && !text) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return null
  return text
}

function safeHttpsUrl(value: unknown, max = 2048): string | null {
  const text = boundedText(value, max)
  if (text == null) return null
  if (!text) return ""
  try {
    const url = new URL(text)
    if (url.protocol !== "https:" || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function safeResourceUrl(value: unknown, max = 2048): string | null {
  const text = boundedText(value, max)
  if (text == null) return null
  if (!text) return ""
  // Match the community renderer: same-origin relative paths are valid, but
  // protocol-relative URLs, backslashes, control chars and unsafe schemes are not.
  if (/[\u0000-\u001f\\]/.test(text) || text.startsWith("//")) return null
  try {
    const url = new URL(text, "https://greenhaven.invalid")
    if (url.protocol !== "https:" || url.username || url.password) return null
    if (url.origin !== "https://greenhaven.invalid" && !/^https:\/\//i.test(text)) return null
    return text
  } catch {
    return null
  }
}

const ALLOWED = new Set([
  "announcement_create",
  "event_create",
  "event_rsvp",
  "resource_upsert",
  "report_create",
  "report_resolve",
  "member_remove",
  "member_ban",
])

export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await ctx.params
  const communityId = sanitizeCommunityId(id)
  if (!communityId || !/^[a-zA-Z0-9_-]{1,160}$/.test(communityId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: NO_STORE })
  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Community platform", { community: null })
    return NextResponse.json(nd.body, { status: nd.status, headers: NO_STORE })
  }
  const result = await socialRpc("gh_community_platform_get", {
    p_community_id: communityId,
    p_viewer_id: auth.userId,
  })
  const data = result.data as { ok?: boolean; error?: string; community?: unknown }
  if (!result.ok || data?.ok === false) {
    const code = data?.error || result.error || "PLATFORM_READ_FAILED"
    return NextResponse.json({ ok: false, error: code }, { status: code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : 503, headers: NO_STORE })
  }
  return NextResponse.json({ ok: true, durable: true, community: data.community }, { headers: NO_STORE })
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await ctx.params
  const communityId = sanitizeCommunityId(id)
  if (!communityId || !/^[a-zA-Z0-9_-]{1,160}$/.test(communityId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: NO_STORE })
  const parsedBody = await readBoundedJson(request, 64 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: NO_STORE })
  const body = parsedBody.value as Record<string, unknown>
  const action = String(body.action || "").trim()
  if (!ALLOWED.has(action)) return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400, headers: NO_STORE })
  const rateLimited = await enforceUserMutationRateLimit(auth.userId, `communities/[id]/platform:${action}`, 30, 60_000, { failClosed: true })
  if (rateLimited) return rateLimited
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Community platform write", { extra: { action } })
    return NextResponse.json(nd.body, { status: nd.status, headers: NO_STORE })
  }

  let fn = ""
  let rpcBody: Record<string, unknown> = {}
  switch (action) {
    case "announcement_create": {
      const title = boundedText(body.title, 120, true)
      const content = boundedText(body.content, 5000, true)
      const type = String(body.type || "info")
      if (!title || !content || !["info", "important", "celebration", "maintenance"].includes(type)) return NextResponse.json({ ok: false, error: "INVALID_ANNOUNCEMENT" }, { status: 400, headers: NO_STORE })
      fn = "gh_community_announcement_create"
      rpcBody = { p_community_id: communityId, p_actor_id: auth.userId, p_title: title, p_content: content, p_type: type, p_pinned: body.pinned === true }
      break
    }
    case "event_create": {
      const startsAt = new Date(String(body.startsAt || ""))
      const endsAt = new Date(String(body.endsAt || ""))
      const title = boundedText(body.title, 120, true)
      const description = boundedText(body.description, 5000)
      const location = boundedText(body.location, 300)
      const virtualLink = body.virtualLink == null || body.virtualLink === "" ? "" : safeHttpsUrl(body.virtualLink)
      const category = String(body.category || "meeting")
      if (!title || description == null || location == null || virtualLink == null || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt || !["meeting", "social", "workshop", "discussion", "celebration"].includes(category)) {
        return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400, headers: NO_STORE })
      }
      fn = "gh_community_event_create"
      rpcBody = { p_community_id: communityId, p_actor_id: auth.userId, p_title: title, p_description: description, p_starts_at: startsAt.toISOString(), p_ends_at: endsAt.toISOString(), p_location: location || null, p_virtual_link: virtualLink || null, p_category: category }
      break
    }
    case "event_rsvp": {
      const eventId = boundedText(body.eventId, 180, true)
      const status = String(body.status || "going")
      if (!eventId || !["going", "maybe", "declined"].includes(status)) return NextResponse.json({ ok: false, error: "INVALID_RSVP" }, { status: 400, headers: NO_STORE })
      fn = "gh_community_event_rsvp"
      rpcBody = { p_event_id: eventId, p_actor_id: auth.userId, p_status: status }
      break
    }
    case "resource_upsert": {
      const resourceId = body.id == null || body.id === "" ? null : boundedText(body.id, 180, true)
      const title = boundedText(body.title, 120, true)
      const description = boundedText(body.description, 1500)
      const type = String(body.type || "link")
      const url = body.url == null || body.url === "" ? "" : safeResourceUrl(body.url)
      const content = boundedText(body.content, 20000)
      const sortOrder = body.sortOrder == null ? 0 : Number(body.sortOrder)
      if ((body.id != null && body.id !== "" && !resourceId) || !title || description == null || url == null || content == null || (!url && !content) || !["document", "link", "guide", "template", "media"].includes(type) || !Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) return NextResponse.json({ ok: false, error: "INVALID_RESOURCE" }, { status: 400, headers: NO_STORE })
      fn = "gh_community_resource_upsert"
      rpcBody = { p_community_id: communityId, p_actor_id: auth.userId, p_id: resourceId, p_title: title, p_description: description, p_type: type, p_url: url || null, p_content: content || null, p_sort_order: sortOrder }
      break
    }
    case "report_create": {
      const targetType = String(body.targetType || "")
      const targetId = boundedText(body.targetId, 180, true)
      const reason = String(body.reason || "")
      const note = boundedText(body.note, 2000)
      if (!targetId || note == null || !["community", "post", "member", "event", "resource"].includes(targetType) || !["spam", "harassment", "hate", "misinformation", "impersonation", "safety", "other"].includes(reason)) return NextResponse.json({ ok: false, error: "INVALID_REPORT" }, { status: 400, headers: NO_STORE })
      fn = "gh_community_report_create"
      rpcBody = { p_community_id: communityId, p_actor_id: auth.userId, p_target_type: targetType, p_target_id: targetId, p_reason: reason, p_note: note }
      break
    }
    case "report_resolve": {
      const reportId = boundedText(body.reportId, 180, true)
      const status = String(body.status || "resolved")
      const resolutionNote = boundedText(body.resolutionNote, 2000)
      if (!reportId || resolutionNote == null || !["reviewing", "resolved", "dismissed"].includes(status)) return NextResponse.json({ ok: false, error: "INVALID_RESOLUTION" }, { status: 400, headers: NO_STORE })
      fn = "gh_community_report_resolve"
      rpcBody = { p_community_id: communityId, p_actor_id: auth.userId, p_report_id: reportId, p_status: status, p_resolution_note: resolutionNote }
      break
    }
    case "member_remove":
    case "member_ban": {
      const targetUserId = boundedText(body.targetUserId, 160, true)
      if (!targetUserId) return NextResponse.json({ ok: false, error: "INVALID_MEMBER" }, { status: 400, headers: NO_STORE })
      fn = "gh_community_member_remove"
      rpcBody = { p_community_id: communityId, p_actor_id: auth.userId, p_target_id: targetUserId, p_ban: action === "member_ban" }
      break
    }
  }

  const result = await socialRpc(fn, rpcBody)
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    const code = data?.error || result.error || "PLATFORM_WRITE_FAILED"
    const status = code === "FORBIDDEN" || code === "CANNOT_REMOVE" ? 403 : code === "NOT_FOUND" ? 404 : code === "BANNED" ? 403 : 400
    return NextResponse.json({ ok: false, error: code }, { status, headers: NO_STORE })
  }
  return NextResponse.json({ ok: true, durable: true, ...(data || {}) }, { headers: NO_STORE })
}
