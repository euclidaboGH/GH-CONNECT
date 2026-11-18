import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Assignment = { id: string; project_id: string; user_id: string; assignment_role: string; status: string; starts_at: string | null; ends_at: string | null }

export async function PATCH(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { assignmentId } = await context.params
  if (!UUID.test(assignmentId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-assignment-accept:${auth.userId}`, 20, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })

  const found = await supabaseRest<Assignment[]>(`gh_research_agent_assignments?id=eq.${encodeURIComponent(assignmentId)}&user_id=eq.${encodeURIComponent(auth.userId)}&select=id,project_id,user_id,assignment_role,status,starts_at,ends_at&limit=1`, { maxResponseBytes: 32 * 1024 })
  if (!found.ok) return NextResponse.json({ ok: false, error: "ELECTION_ASSIGNMENTS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const assignment = found.data?.[0]
  if (!assignment) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (!UUID.test(assignment.project_id) || !["observer", "supervisor", "coordinator"].includes(assignment.assignment_role)) return NextResponse.json({ ok: false, error: "ASSIGNMENT_NOT_ELIGIBLE" }, { status: 409, headers: NO_STORE })
  if (assignment.status === "accepted" || assignment.status === "active") return NextResponse.json({ ok: true, assignment: { id: assignment.id, status: assignment.status }, idempotent: true }, { headers: NO_STORE })
  if (assignment.status !== "assigned") return NextResponse.json({ ok: false, error: "ASSIGNMENT_NOT_ACCEPTABLE" }, { status: 409, headers: NO_STORE })

  const now = Date.now()
  const startsAt = assignment.starts_at ? Date.parse(assignment.starts_at) : null
  const endsAt = assignment.ends_at ? Date.parse(assignment.ends_at) : null
  if ((startsAt !== null && (!Number.isFinite(startsAt) || startsAt > now)) || (endsAt !== null && (!Number.isFinite(endsAt) || endsAt <= now))) {
    return NextResponse.json({ ok: false, error: "ASSIGNMENT_OUTSIDE_ACTIVE_WINDOW" }, { status: 409, headers: NO_STORE })
  }
  const project = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(assignment.project_id)}&project_type=eq.election_observation&select=id&limit=1`, { maxResponseBytes: 16 * 1024 })
  if (!project.ok) return NextResponse.json({ ok: false, error: "ELECTION_PROJECT_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!project.data?.length) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const membership = await supabaseRest<Array<{ role: string }>>(`gh_research_members?project_id=eq.${encodeURIComponent(assignment.project_id)}&user_id=eq.${encodeURIComponent(auth.userId)}&status=eq.active&select=role&limit=1`, { maxResponseBytes: 16 * 1024 })
  if (!membership.ok) return NextResponse.json({ ok: false, error: "ELECTION_MEMBERSHIP_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (!membership.data?.[0] || !["owner", "editor", "field_agent"].includes(membership.data[0].role)) return NextResponse.json({ ok: false, error: "AGENT_NOT_ACTIVE_PROJECT_MEMBER" }, { status: 403, headers: NO_STORE })

  const updated = await supabaseRest<Assignment[]>(`gh_research_agent_assignments?id=eq.${encodeURIComponent(assignmentId)}&user_id=eq.${encodeURIComponent(auth.userId)}&status=eq.assigned&select=id,status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "accepted" }),
    maxResponseBytes: 32 * 1024,
  })
  if (!updated.ok) return NextResponse.json({ ok: false, error: "ASSIGNMENT_ACCEPT_FAILED" }, { status: 503, headers: NO_STORE })
  if (updated.data?.[0]) return NextResponse.json({ ok: true, assignment: updated.data[0], idempotent: false }, { status: 200, headers: NO_STORE })

  const retry = await supabaseRest<Assignment[]>(`gh_research_agent_assignments?id=eq.${encodeURIComponent(assignmentId)}&user_id=eq.${encodeURIComponent(auth.userId)}&select=id,status&limit=1`, { maxResponseBytes: 16 * 1024 })
  if (retry.ok && retry.data?.[0] && ["accepted", "active"].includes(retry.data[0].status)) return NextResponse.json({ ok: true, assignment: retry.data[0], idempotent: true }, { headers: NO_STORE })
  return NextResponse.json({ ok: false, error: "ASSIGNMENT_ACCEPT_CONFLICT" }, { status: 409, headers: NO_STORE })
}
