import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRest } from "@/lib/server/supabase/rest-client"
import { reconcileElectionTallies, type ElectionTallyInput, type ElectionCandidateVoteInput } from "@/lib/research/election-reconciliation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const inFilter = (ids: string[]) => `in.(${ids.map((id) => encodeURIComponent(id)).join(",")})`

type Project = { id: string; owner_user_id: string; project_type: string }
type Member = { role: string; status: string }
type Contest = { id: string; project_id: string; title: string; status: string }
type Candidate = { id: string; candidate_name: string; party_name: string }

export async function GET(request: Request, context: { params: Promise<{ id: string; contestId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id, contestId } = await context.params
  if (!UUID.test(id) || !UUID.test(contestId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-reconcile:${auth.userId}:${contestId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })

  const projectResult = await supabaseRest<Project[]>(`gh_research_projects?id=eq.${encodeURIComponent(id)}&project_type=eq.election_observation&select=id,owner_user_id,project_type&limit=1`, { maxResponseBytes: 32 * 1024 })
  if (!projectResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_PROJECT_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const project = projectResult.data?.[0]
  if (!project) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  if (project.owner_user_id !== auth.userId) {
    const member = await supabaseRest<Member[]>(`gh_research_members?project_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(auth.userId)}&status=eq.active&role=in.(owner,reviewer)&select=role,status&limit=1`, { maxResponseBytes: 32 * 1024 })
    if (!member.ok) return NextResponse.json({ ok: false, error: "ELECTION_REVIEW_ACCESS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
    if (!member.data?.length) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: NO_STORE })
  }

  const contestResult = await supabaseRest<Contest[]>(`gh_research_election_contests?id=eq.${encodeURIComponent(contestId)}&project_id=eq.${encodeURIComponent(id)}&select=id,project_id,title,status&limit=1`, { maxResponseBytes: 32 * 1024 })
  if (!contestResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_CONTEST_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const contest = contestResult.data?.[0]
  if (!contest) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })

  const tallyResult = await supabaseRest<ElectionTallyInput[]>(`gh_research_tallies?project_id=eq.${encodeURIComponent(id)}&contest_id=eq.${encodeURIComponent(contestId)}&select=id,geo_unit_id,polling_unit_code,agent_user_id,registered_voters,accredited_voters,total_ballots,valid_votes,rejected_ballots,submitted_at&order=polling_unit_code.asc,submitted_at.asc&limit=251`, { maxResponseBytes: 512 * 1024 })
  if (!tallyResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_TALLIES_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const tallies = tallyResult.data || []
  if (tallies.length > 250) return NextResponse.json({ ok: false, error: "RECONCILIATION_SCOPE_TOO_LARGE", limit: 250 }, { status: 409, headers: NO_STORE })
  if (!tallies.length) return NextResponse.json({ ok: true, contest: { id: contest.id, title: contest.title }, groups: [], candidateNames: {}, complete: true, certified: false }, { headers: NO_STORE })

  const tallyIds = tallies.map((item) => item.id).filter((item) => UUID.test(item))
  if (tallyIds.length !== tallies.length) return NextResponse.json({ ok: false, error: "INVALID_TALLY_RECORD" }, { status: 503, headers: NO_STORE })
  const voteResult = await supabaseRest<ElectionCandidateVoteInput[]>(`gh_research_tally_candidate_votes?tally_id=${inFilter(tallyIds)}&select=tally_id,candidate_id,votes&order=tally_id.asc,candidate_id.asc&limit=25000`, { maxResponseBytes: 2 * 1024 * 1024 })
  if (!voteResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_CANDIDATE_VOTES_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const candidateIds = [...new Set((voteResult.data || []).map((item) => item.candidate_id).filter((item) => UUID.test(item)))]
  const candidateResult = candidateIds.length
    ? await supabaseRest<Candidate[]>(`gh_research_candidates?id=${inFilter(candidateIds)}&contest_id=eq.${encodeURIComponent(contestId)}&select=id,candidate_name,party_name&limit=100`, { maxResponseBytes: 128 * 1024 })
    : { ok: true as const, data: [] as Candidate[], status: 200, headers: new Headers() }
  if (!candidateResult.ok) return NextResponse.json({ ok: false, error: "ELECTION_CANDIDATE_LABELS_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const candidateNames = Object.fromEntries((candidateResult.data || []).map((item) => [item.id, { name: item.candidate_name, party: item.party_name }]))
  const groups = reconcileElectionTallies(tallies, voteResult.data || [])
  return NextResponse.json({
    ok: true,
    contest: { id: contest.id, title: contest.title },
    groups,
    candidateNames,
    complete: true,
    certified: false,
    note: "Independent comparison only. Consistency does not certify official election results.",
  }, { headers: NO_STORE })
}
