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

export async function PATCH(request: Request, context: { params: Promise<{ id: string; memberId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id, memberId } = await context.params
  if (!UUID.test(id) || !UUID.test(memberId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-member-change:${auth.userId}`, 40, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const action = typeof parsed.value.action === "string" ? parsed.value.action : ""
  if (!new Set(["accept", "revoke", "suspend", "reactivate", "change_role"]).has(action)) return NextResponse.json({ ok: false, error: "INVALID_MEMBER_ACTION" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const memberQuery = `gh_research_members?id=eq.${encodeURIComponent(memberId)}&project_id=eq.${encodeURIComponent(id)}&select=id,user_id,role,status&limit=1`
  const memberResult = await supabaseRest<Array<Record<string, unknown>>>(memberQuery)
  if (!memberResult.ok) return NextResponse.json({ ok: false, error: "RESEARCH_MEMBERS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const member = memberResult.data?.[0]
  if (!member) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const ownerResult = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(id)}&owner_user_id=eq.${encodeURIComponent(auth.userId)}&select=id&limit=1`)
  if (!ownerResult.ok) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const isOwner = Boolean(ownerResult.data?.length)
  const isInvitee = String(member.user_id) === auth.userId
  if (!isOwner && !(isInvitee && action === "accept")) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: NO_STORE })
  if (action === "accept" && (member.status !== "invited" || !isInvitee)) return NextResponse.json({ ok: false, error: "INVITATION_NOT_ACCEPTABLE" }, { status: 409, headers: NO_STORE })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (action === "accept") patch.status = "active"
  if (action === "revoke") patch.status = "revoked"
  if (action === "suspend") patch.status = "suspended"
  if (action === "reactivate") patch.status = "active"
  if (action === "change_role") {
    const role = typeof parsed.value.role === "string" ? parsed.value.role : ""
    if (!ROLE.has(role)) return NextResponse.json({ ok: false, error: "INVALID_MEMBER_ROLE" }, { status: 400, headers: NO_STORE })
    patch.role = role
  }
  const statusGuard = action === "accept" ? "&status=eq.invited" : ""
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_members?id=eq.${encodeURIComponent(memberId)}&project_id=eq.${encodeURIComponent(id)}${statusGuard}&select=id,user_id,role,status,updated_at`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(patch) })
  if (!updated.ok) return NextResponse.json({ ok: false, error: "RESEARCH_MEMBER_UPDATE_FAILED" }, { status: 503, headers: NO_STORE })
  if (!updated.data?.[0]) return NextResponse.json({ ok: false, error: action === "accept" ? "INVITATION_NOT_ACCEPTABLE" : "NOT_FOUND" }, { status: action === "accept" ? 409 : 404, headers: NO_STORE })
  return NextResponse.json({ ok: true, member: updated.data[0] }, { headers: NO_STORE })
}
