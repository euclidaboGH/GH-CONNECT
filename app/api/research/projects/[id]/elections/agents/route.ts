import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ROLES = new Set(["observer", "supervisor", "coordinator", "reviewer"])
const STATUSES = new Set(["assigned", "accepted", "active", "completed", "revoked"])

async function owned(projectId: string, userId: string) {
  const result = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(projectId)}&owner_user_id=eq.${encodeURIComponent(userId)}&project_type=eq.election_observation&select=id&limit=1`)
  return result.ok ? Boolean(result.data?.length) : null
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const access = await owned(id, auth.userId)
  if (access === null) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const result = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_agent_assignments?project_id=eq.${encodeURIComponent(id)}&select=id,user_id,geo_unit_id,assignment_role,status,starts_at,ends_at,created_at&order=created_at.desc&limit=500`)
  if (!result.ok) return NextResponse.json({ ok: false, error: "ELECTION_ASSIGNMENTS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, assignments: result.data || [] }, { headers: NO_STORE })
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-agent:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 3 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const body = parsed.value
  const userId = typeof body.userId === "string" ? body.userId.trim() : ""
  const geo = body.geoUnitId === null || body.geoUnitId === undefined || body.geoUnitId === "" ? null : body.geoUnitId
  const role = typeof body.assignmentRole === "string" ? body.assignmentRole : "observer"
  const startsAt = body.startsAt === null || body.startsAt === undefined || body.startsAt === "" ? null : body.startsAt
  const endsAt = body.endsAt === null || body.endsAt === undefined || body.endsAt === "" ? null : body.endsAt
  const validDate = (value: unknown) => typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value))
  if (!userId || userId.length > 256 || /[\u0000-\u001f\u007f]/.test(userId) || (geo !== null && (typeof geo !== "string" || !UUID.test(geo))) || !ROLES.has(role) || (startsAt !== null && !validDate(startsAt)) || (endsAt !== null && !validDate(endsAt)) || (startsAt !== null && endsAt !== null && Date.parse(String(endsAt)) <= Date.parse(String(startsAt)))) return NextResponse.json({ ok: false, error: "INVALID_AGENT_ASSIGNMENT" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const access = await owned(id, auth.userId)
  if (access === null) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const membership = await supabaseRest<Array<{ role: string }>>(`gh_research_members?project_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=role&limit=1`)
  if (!membership.ok) return NextResponse.json({ ok: false, error: "RESEARCH_MEMBERS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!membership.data?.[0] || !["owner", "editor", "field_agent"].includes(membership.data[0].role)) return NextResponse.json({ ok: false, error: "AGENT_NOT_ACTIVE_PROJECT_MEMBER" }, { status: 409, headers: NO_STORE })
  const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_research_agent_assignments?select=id,user_id,geo_unit_id,assignment_role,status,starts_at,ends_at,created_at", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ project_id: id, user_id: userId, geo_unit_id: geo, assignment_role: role, status: "assigned", assigned_by: auth.userId, starts_at: startsAt, ends_at: endsAt }) })
  if (!saved.ok || !saved.data?.[0]) return NextResponse.json({ ok: false, error: "ELECTION_AGENT_ASSIGNMENT_FAILED" }, { status: 409, headers: NO_STORE })
  return NextResponse.json({ ok: true, assignment: saved.data[0] }, { status: 201, headers: NO_STORE })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const assignmentId = typeof parsed.value.assignmentId === "string" ? parsed.value.assignmentId : ""
  const status = typeof parsed.value.status === "string" ? parsed.value.status : ""
  if (!UUID.test(assignmentId) || !STATUSES.has(status)) return NextResponse.json({ ok: false, error: "INVALID_AGENT_ASSIGNMENT_UPDATE" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const access = await owned(id, auth.userId)
  if (access === null) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_agent_assignments?id=eq.${encodeURIComponent(assignmentId)}&project_id=eq.${encodeURIComponent(id)}&select=id,user_id,geo_unit_id,assignment_role,status,starts_at,ends_at`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ status }) })
  if (!updated.ok) return NextResponse.json({ ok: false, error: "ELECTION_AGENT_UPDATE_FAILED" }, { status: 503, headers: NO_STORE })
  if (!updated.data?.[0]) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  return NextResponse.json({ ok: true, assignment: updated.data[0] }, { headers: NO_STORE })
}
