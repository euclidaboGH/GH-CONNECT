import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function authorize(projectId: string, contestId: string, userId: string) {
  const owner = await supabaseRest<Array<{ id: string }>>(`gh_research_projects?id=eq.${encodeURIComponent(projectId)}&owner_user_id=eq.${encodeURIComponent(userId)}&project_type=eq.election_observation&select=id&limit=1`)
  if (!owner.ok) return "unavailable" as const
  if (!owner.data?.length) return "denied" as const
  const contest = await supabaseRest<Array<{ id: string; status: string }>>(`gh_research_election_contests?id=eq.${encodeURIComponent(contestId)}&project_id=eq.${encodeURIComponent(projectId)}&select=id,status&limit=1`)
  if (!contest.ok) return "unavailable" as const
  if (!contest.data?.length) return "missing" as const
  return contest.data[0]
}

export async function GET(request: Request, context: { params: Promise<{ id: string; contestId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id, contestId } = await context.params
  if (!UUID.test(id) || !UUID.test(contestId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const access = await authorize(id, contestId, auth.userId)
  if (access === "unavailable") return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (access === "denied" || access === "missing") return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const result = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_candidates?contest_id=eq.${encodeURIComponent(contestId)}&select=id,candidate_name,party_name,ballot_order,external_ref,is_active,created_at&order=ballot_order.asc.nullslast,candidate_name.asc&limit=500`)
  if (!result.ok) return NextResponse.json({ ok: false, error: "ELECTION_CANDIDATES_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, candidates: result.data || [] }, { headers: NO_STORE })
}

export async function POST(request: Request, context: { params: Promise<{ id: string; contestId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id, contestId } = await context.params
  if (!UUID.test(id) || !UUID.test(contestId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-candidate:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 3 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const body = parsed.value
  const name = typeof body.candidateName === "string" ? body.candidateName.trim() : ""
  const party = typeof body.partyName === "string" ? body.partyName.trim() : ""
  const order = body.ballotOrder === null || body.ballotOrder === undefined || body.ballotOrder === "" ? null : body.ballotOrder
  const external = body.externalRef === null || body.externalRef === undefined ? null : body.externalRef
  if (!name || name.length > 180 || /[\u0000-\u001f\u007f]/.test(name) || party.length > 120 || /[\u0000-\u001f\u007f]/.test(party) || (order !== null && (!Number.isInteger(order) || Number(order) < 1 || Number(order) > 1000)) || (external !== null && (typeof external !== "string" || external.length > 120 || /[\u0000-\u001f\u007f]/.test(external)))) return NextResponse.json({ ok: false, error: "INVALID_CANDIDATE" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const access = await authorize(id, contestId, auth.userId)
  if (access === "unavailable") return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (access === "denied" || access === "missing") return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (access.status !== "draft") return NextResponse.json({ ok: false, error: "CONTEST_NOT_EDITABLE" }, { status: 409, headers: NO_STORE })
  const saved = await supabaseRest<Array<Record<string, unknown>>>("gh_research_candidates?select=id,candidate_name,party_name,ballot_order,external_ref,is_active,created_at", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ contest_id: contestId, candidate_name: name, party_name: party, ballot_order: order, external_ref: external }) })
  if (!saved.ok || !saved.data?.[0]) return NextResponse.json({ ok: false, error: "ELECTION_CANDIDATE_CREATE_FAILED" }, { status: 503, headers: NO_STORE })
  return NextResponse.json({ ok: true, candidate: saved.data[0] }, { status: 201, headers: NO_STORE })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; contestId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id, contestId } = await context.params
  if (!UUID.test(id) || !UUID.test(contestId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-candidate-change:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 2 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400, headers: NO_STORE })
  const candidateId = typeof parsed.value.candidateId === "string" ? parsed.value.candidateId : ""
  const active = parsed.value.isActive
  if (!UUID.test(candidateId) || typeof active !== "boolean") return NextResponse.json({ ok: false, error: "INVALID_CANDIDATE_UPDATE" }, { status: 400, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const access = await authorize(id, contestId, auth.userId)
  if (access === "unavailable") return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  if (access === "denied" || access === "missing") return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (access.status !== "draft") return NextResponse.json({ ok: false, error: "CONTEST_NOT_EDITABLE" }, { status: 409, headers: NO_STORE })
  const updated = await supabaseRest<Array<Record<string, unknown>>>(`gh_research_candidates?id=eq.${encodeURIComponent(candidateId)}&contest_id=eq.${encodeURIComponent(contestId)}&select=id,candidate_name,party_name,is_active`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ is_active: active }) })
  if (!updated.ok) return NextResponse.json({ ok: false, error: "ELECTION_CANDIDATE_UPDATE_FAILED" }, { status: 503, headers: NO_STORE })
  if (!updated.data?.[0]) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  return NextResponse.json({ ok: true, candidate: updated.data[0] }, { headers: NO_STORE })
}
