import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const inFilter = (ids: string[]) => `in.(${ids.map((id) => encodeURIComponent(id)).join(",")})`

type Assignment = { id: string; project_id: string; user_id: string; geo_unit_id: string | null; assignment_role: string; status: string; starts_at: string | null; ends_at: string | null }
type Project = { id: string; title: string; project_type: string }
type Member = { project_id: string; role: string; status: string }
type Contest = { id: string; project_id: string; title: string; country_code: string; election_date: string | null; status: string }
type Candidate = { id: string; contest_id: string; candidate_name: string; party_name: string; ballot_order: number | null }
type GeoUnit = { id: string; country_code: string; level_key: string; name: string; external_code: string | null; source_ref: string | null; source_version: string | null; is_active: boolean }

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth || !auth.userId || auth.userId.length > 256) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-assigned:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })

  const assigned = await supabaseRest<Assignment[]>(`gh_research_agent_assignments?user_id=eq.${encodeURIComponent(auth.userId)}&status=in.(assigned,accepted,active)&assignment_role=in.(observer,supervisor,coordinator)&select=id,project_id,user_id,geo_unit_id,assignment_role,status,starts_at,ends_at&order=created_at.desc&limit=100`, { maxResponseBytes: 256 * 1024 })
  if (!assigned.ok) return NextResponse.json({ ok: false, error: "ELECTION_ASSIGNMENTS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const now = Date.now()
  const activeAssignments = (assigned.data || []).filter((item) => {
    const startsAt = item.starts_at ? Date.parse(item.starts_at) : null
    const endsAt = item.ends_at ? Date.parse(item.ends_at) : null
    return UUID.test(item.id) && UUID.test(item.project_id) && item.user_id === auth.userId &&
      (startsAt === null || Number.isFinite(startsAt)) &&
      (endsAt === null || (Number.isFinite(endsAt) && endsAt > now))
  })
  if (!activeAssignments.length) return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE })

  const projectIds = [...new Set(activeAssignments.map((item) => item.project_id))]
  const projectsResult = await supabaseRest<Project[]>(`gh_research_projects?id=${inFilter(projectIds)}&project_type=eq.election_observation&select=id,title,project_type&limit=100`, { maxResponseBytes: 256 * 1024 })
  if (!projectsResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_PROJECTS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const projects = new Map((projectsResult.data || []).map((item) => [item.id, item]))
  const membershipResult = await supabaseRest<Member[]>(`gh_research_members?project_id=${inFilter(projectIds)}&user_id=eq.${encodeURIComponent(auth.userId)}&status=eq.active&select=project_id,role,status&limit=100`, { maxResponseBytes: 128 * 1024 })
  if (!membershipResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_MEMBERSHIP_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const activeMemberships = new Set((membershipResult.data || []).filter((item) => ["owner", "editor", "field_agent"].includes(item.role) && item.status === "active").map((item) => item.project_id))
  const eligibleAssignments = activeAssignments.filter((item) => projects.has(item.project_id) && activeMemberships.has(item.project_id))
  if (!eligibleAssignments.length) return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE })

  const contestProjectIds = [...new Set(eligibleAssignments.map((item) => item.project_id))]
  const contestsResult = await supabaseRest<Contest[]>(`gh_research_election_contests?project_id=${inFilter(contestProjectIds)}&status=eq.active&select=id,project_id,title,country_code,election_date,status&order=election_date.asc.nullslast&limit=200`, { maxResponseBytes: 512 * 1024 })
  if (!contestsResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_CONTESTS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const contests = contestsResult.data || []
  if (!contests.length) return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE })

  const contestIds = contests.filter((item) => UUID.test(item.id)).map((item) => item.id)
  const candidatesResult = await supabaseRest<Candidate[]>(`gh_research_candidates?contest_id=${inFilter(contestIds)}&is_active=eq.true&select=id,contest_id,candidate_name,party_name,ballot_order&order=ballot_order.asc.nullslast,candidate_name.asc&limit=5000`, { maxResponseBytes: 1024 * 1024 })
  if (!candidatesResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_CANDIDATES_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const candidatesByContest = new Map<string, Candidate[]>()
  for (const candidate of candidatesResult.data || []) {
    const rows = candidatesByContest.get(candidate.contest_id) || []
    rows.push(candidate)
    candidatesByContest.set(candidate.contest_id, rows)
  }

  const geoIds = [...new Set(eligibleAssignments.map((item) => item.geo_unit_id).filter((id): id is string => Boolean(id && UUID.test(id))))]
  const geoResult = geoIds.length
    ? await supabaseRest<GeoUnit[]>(`gh_research_geo_units?id=${inFilter(geoIds)}&is_active=eq.true&select=id,country_code,level_key,name,external_code,source_ref,source_version,is_active&limit=200`, { maxResponseBytes: 256 * 1024 })
    : { ok: true as const, data: [] as GeoUnit[], status: 200, headers: new Headers() }
  if (!geoResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_GEOGRAPHY_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const geoUnits = new Map((geoResult.data || []).map((item) => [item.id, item]))
  const contestByProject = new Map<string, Contest[]>()
  for (const contest of contests) {
    const rows = contestByProject.get(contest.project_id) || []
    rows.push(contest)
    contestByProject.set(contest.project_id, rows)
  }

  const items = eligibleAssignments.flatMap((assignment) => (contestByProject.get(assignment.project_id) || []).map((contest) => {
    const geo = assignment.geo_unit_id ? geoUnits.get(assignment.geo_unit_id) || null : null
    const candidates = candidatesByContest.get(contest.id) || []
    const blockers: string[] = []
    const startsAt = assignment.starts_at ? Date.parse(assignment.starts_at) : null
    if (startsAt !== null && startsAt > now) blockers.push("This assignment has not started yet.")
    if (assignment.status === "assigned") blockers.push("Accept this assignment before submitting a tally.")
    if (!geo) blockers.push("A specific active polling-unit assignment is required.")
    else {
      if (geo.level_key !== "polling_unit") blockers.push("The assigned geography is not a polling unit.")
      if (!geo.external_code) blockers.push("The polling unit has no authoritative external code.")
      if (!geo.source_ref || !geo.source_version) blockers.push("The polling-unit source provenance is incomplete.")
      if (geo.country_code !== contest.country_code) blockers.push("The assigned polling unit is outside the contest country.")
    }
    if (!candidates.length) blockers.push("The active contest has no active candidates.")
    return {
      key: `${assignment.id}:${contest.id}`,
      assignmentId: assignment.id,
      projectId: assignment.project_id,
      projectTitle: projects.get(assignment.project_id)?.title || "Election observation",
      contestId: contest.id,
      contestTitle: contest.title,
      countryCode: contest.country_code,
      electionDate: contest.election_date,
      assignmentRole: assignment.assignment_role,
      assignmentStatus: assignment.status,
      canAccept: assignment.status === "assigned" && (startsAt === null || startsAt <= now),
      geoUnit: geo ? { id: geo.id, name: geo.name, pollingUnitCode: geo.external_code, sourceRef: geo.source_ref, sourceVersion: geo.source_version } : null,
      candidates: candidates.map((candidate) => ({ id: candidate.id, name: candidate.candidate_name, party: candidate.party_name, ballotOrder: candidate.ballot_order })),
      canSubmit: blockers.length === 0 && ["accepted", "active"].includes(assignment.status),
      blockers,
    }
  }))
  return NextResponse.json({ ok: true, items }, { headers: NO_STORE })
}
