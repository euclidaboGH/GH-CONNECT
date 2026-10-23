import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableReadResponse, nonDurableWriteResponse } from "@/lib/server/production-guard"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

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
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const { id } = await ctx.params
  const communityId = String(id || "").trim()
  if (!communityId) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Community platform", { community: null })
    return NextResponse.json(nd.body, { status: nd.status, headers: { "Cache-Control": "no-store" } })
  }
  const result = await socialRpc("gh_community_platform_get", {
    p_community_id: communityId,
    p_viewer_id: auth.userId,
  })
  const data = result.data as { ok?: boolean; error?: string; community?: unknown }
  if (!result.ok || data?.ok === false) {
    const code = data?.error || result.error || "PLATFORM_READ_FAILED"
    return NextResponse.json({ ok: false, error: code }, { status: code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : 503 })
  }
  return NextResponse.json({ ok: true, durable: true, community: data.community }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const { id } = await ctx.params
  const communityId = String(id || "").trim()
  if (!communityId) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || "").trim()
  if (!ALLOWED.has(action)) return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 })
  const rl = checkRateLimit(`community-platform:${auth.userId}:${communityId}:${action}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Community platform write", { extra: { action } })
    return NextResponse.json(nd.body, { status: nd.status })
  }

  let fn = ""
  let rpcBody: Record<string, unknown> = {}
  switch (action) {
    case "announcement_create":
      fn = "gh_community_announcement_create"
      rpcBody = {
        p_community_id: communityId, p_actor_id: auth.userId,
        p_title: String(body.title || "").trim(), p_content: String(body.content || "").trim(),
        p_type: String(body.type || "info"), p_pinned: body.pinned === true,
      }
      break
    case "event_create": {
      const startsAt = new Date(String(body.startsAt || ""))
      const endsAt = new Date(String(body.endsAt || ""))
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
        return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 })
      }
      fn = "gh_community_event_create"
      rpcBody = {
        p_community_id: communityId, p_actor_id: auth.userId,
        p_title: String(body.title || "").trim(), p_description: String(body.description || "").trim(),
        p_starts_at: startsAt.toISOString(), p_ends_at: endsAt.toISOString(),
        p_location: body.location ? String(body.location) : null,
        p_virtual_link: body.virtualLink ? String(body.virtualLink) : null,
        p_category: String(body.category || "meeting"),
      }
      break
    }
    case "event_rsvp":
      fn = "gh_community_event_rsvp"
      rpcBody = { p_event_id: String(body.eventId || ""), p_actor_id: auth.userId, p_status: String(body.status || "going") }
      break
    case "resource_upsert":
      fn = "gh_community_resource_upsert"
      rpcBody = {
        p_community_id: communityId, p_actor_id: auth.userId, p_id: body.id ? String(body.id) : null,
        p_title: String(body.title || "").trim(), p_description: String(body.description || "").trim(),
        p_type: String(body.type || "link"), p_url: body.url ? String(body.url) : null,
        p_content: body.content ? String(body.content) : null, p_sort_order: Number(body.sortOrder || 0),
      }
      break
    case "report_create":
      fn = "gh_community_report_create"
      rpcBody = {
        p_community_id: communityId, p_actor_id: auth.userId,
        p_target_type: String(body.targetType || ""), p_target_id: String(body.targetId || ""),
        p_reason: String(body.reason || ""), p_note: String(body.note || ""),
      }
      break
    case "report_resolve":
      fn = "gh_community_report_resolve"
      rpcBody = {
        p_community_id: communityId, p_actor_id: auth.userId, p_report_id: String(body.reportId || ""),
        p_status: String(body.status || "resolved"), p_resolution_note: String(body.resolutionNote || ""),
      }
      break
    case "member_remove":
    case "member_ban":
      fn = "gh_community_member_remove"
      rpcBody = { p_community_id: communityId, p_actor_id: auth.userId, p_target_id: String(body.targetUserId || ""), p_ban: action === "member_ban" }
      break
  }

  const result = await socialRpc(fn, rpcBody)
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    const code = data?.error || result.error || "PLATFORM_WRITE_FAILED"
    const status = code === "FORBIDDEN" || code === "CANNOT_REMOVE" ? 403 : code === "NOT_FOUND" ? 404 : code === "BANNED" ? 403 : 400
    return NextResponse.json({ ok: false, error: code }, { status })
  }
  return NextResponse.json({ ok: true, durable: true, ...(data || {}) })
}
