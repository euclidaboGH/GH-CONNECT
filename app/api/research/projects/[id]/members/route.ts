import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ROLE = new Set(["editor", "reviewer", "field_agent"])

async function ownedProject(projectId: string, userId: string) {
  const result = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(projectId)}&owner_user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`)
  return result.ok && Boolean(result.data?.length)
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!await ownedProject(id, auth.userId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const result = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_members?project_id=eq.${encodeURIComponent(id)}&select=id,user_id,role,status,invited_by,created_at,updated_at&order=created_at.asc&limit=200`)
  if (!result.ok) return NextResponse.json({ ok: false, error: "RESEARCH_MEMBERS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, members: result.data || [] }, { headers: NO_STORE })
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-member-invite:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const userId = typeof parsed.value.userId === "string" ? parsed.value.userId.trim() : ""
  const role = typeof parsed.value.role === "string" ? parsed.value.role : ""
  if (!userId || userId.length > 256 || /[\u0000-\u001f\u007f]/.test(userId) || !ROLE.has(role)) return NextResponse.json({ ok: false, error: "INVALID_MEMBER_INVITATION" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!await ownedProject(id, auth.userId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const existing = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_members?project_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=id,status&limit=1`)
  if (!existing.ok) return NextResponse.json({ ok: false, error: "RESEARCH_MEMBERS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const prior = existing.data?.[0]
  if (prior && prior.status !== "revoked") return NextResponse.json({ ok: false, error: "MEMBER_ALREADY_INVITED_OR_ACTIVE" }, { status: 409, headers: NO_STORE })
  const payload = { project_id: id, user_id: userId, role, status: "invited", invited_by: auth.userId, updated_at: new Date().toISOString() }
  const saved = prior
    ? await supabaseRest<Array<Record<string, unknown>>>(`gh_research_members?id=eq.${encodeURIComponent(String(prior.id))}&project_id=eq.${encodeURIComponent(id)}&status=eq.revoked&select=id,user_id,role,status,created_at`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ role, status: "invited", invited_by: auth.userId, updated_at: payload.updated_at }) })
    : await supabaseRest<Array<Record<string, unknown>>>("gh_research_members?select=id,user_id,role,status,created_at", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(payload) })
  if (!saved.ok || !saved.data?.[0]) return NextResponse.json({ ok: false, error: "RESEARCH_INVITE_FAILED" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, member: saved.data[0] }, { status: 201, headers: NO_STORE })
}
