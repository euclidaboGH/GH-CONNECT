import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TYPES = new Set(["presidential", "gubernatorial", "senatorial", "house", "state_assembly", "local", "referendum", "other"])
const STATUSES = new Set(["draft", "active", "closed", "archived"])

async function ownerProject(projectId: string, userId: string) {
  const result = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(projectId)}&owner_user_id=eq.${encodeURIComponent(userId)}&project_type=eq.election_observation&select=id&limit=1`)
  return result.ok ? Boolean(result.data?.length) : null
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const owner = await ownerProject(id, auth.userId)
  if (owner === null) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!owner) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const result = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_election_contests?project_id=eq.${encodeURIComponent(id)}&select=id,title,election_type,country_code,election_date,geo_unit_id,status,created_at,updated_at&order=created_at.desc&limit=100`)
  if (!result.ok) return NextResponse.json({ ok: false, error: "ELECTIONS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, contests: result.data || [] }, { headers: NO_STORE })
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-create:${auth.userId}`, 20, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const body = parsed.value
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const type = typeof body.electionType === "string" ? body.electionType : ""
  const country = typeof body.countryCode === "string" ? body.countryCode.toUpperCase() : ""
  const date = body.electionDate === null || body.electionDate === undefined || body.electionDate === "" ? null : body.electionDate
  const geo = body.geoUnitId === null || body.geoUnitId === undefined || body.geoUnitId === "" ? null : body.geoUnitId
  if (title.length < 1 || title.length > 180 || /[\u0000-\u001f\u007f]/.test(title) || !TYPES.has(type) || !/^[A-Z]{2}$/.test(country) || (date !== null && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) || (geo !== null && (typeof geo !== "string" || !UUID.test(geo)))) return NextResponse.json({ ok: false, error: "INVALID_ELECTION_CONTEST" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const owner = await ownerProject(id, auth.userId)
  if (owner === null) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!owner) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_research_election_contests?select=id,title,election_type,country_code,election_date,geo_unit_id,status,created_at", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ project_id: id, title, election_type: type, country_code: country, election_date: date, geo_unit_id: geo, created_by: auth.userId }) })
  if (!saved.ok) return NextResponse.json({ ok: false, error: "ELECTION_CONTEST_CREATE_FAILED" }, { status: 503, headers: NO_STORE })
  if (!saved.data?.[0]) return NextResponse.json({ ok: false, error: "ELECTION_CONTEST_CREATE_FAILED" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, contest: saved.data[0] }, { status: 201, headers: NO_STORE })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const contestId = typeof parsed.value.contestId === "string" ? parsed.value.contestId : ""
  const status = typeof parsed.value.status === "string" ? parsed.value.status : ""
  if (!UUID.test(contestId) || !STATUSES.has(status)) return NextResponse.json({ ok: false, error: "INVALID_CONTEST_STATUS" }, { status: 400, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-status:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const owner = await ownerProject(id, auth.userId)
  if (owner === null) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!owner) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const current = await supabaseRest<Array<{ id: string; status: string }>>(`gh_research_election_contests?id=eq.${encodeURIComponent(contestId)}&project_id=eq.${encodeURIComponent(id)}&select=id,status&limit=1`)
  if (!current.ok) return NextResponse.json({ ok: false, error: "ELECTION_CONTEST_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!current.data?.[0]) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const transitions: Record<string, string[]> = { draft: ["active", "archived"], active: ["closed"], closed: ["archived"], archived: [] }
  if (!transitions[current.data[0].status]?.includes(status)) return NextResponse.json({ ok: false, error: "INVALID_CONTEST_TRANSITION" }, { status: 409, headers: NO_STORE })
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_election_contests?id=eq.${encodeURIComponent(contestId)}&project_id=eq.${encodeURIComponent(id)}&status=eq.${encodeURIComponent(current.data[0].status)}&select=id,title,status,updated_at`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ status, updated_at: new Date().toISOString() }) })
  if (!updated.ok) return NextResponse.json({ ok: false, error: "ELECTION_CONTEST_UPDATE_FAILED" }, { status: 503, headers: NO_STORE })
  if (!updated.data?.[0]) return NextResponse.json({ ok: false, error: "INVALID_CONTEST_TRANSITION" }, { status: 409, headers: NO_STORE })
  return NextResponse.json({ ok: true, contest: updated.data[0] }, { headers: NO_STORE })
}
