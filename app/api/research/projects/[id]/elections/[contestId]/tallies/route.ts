import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getServiceSupabaseConfig, supabaseRpc } from "@/lib/server/supabase/rest-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_COUNT = 1_000_000_000

type CandidateVote = { candidateId: string; votes: number }
type TallyResult = { ok: boolean; code?: string; tallyId?: string; idempotent?: boolean; reconciliationStatus?: string }

export async function POST(request: Request, context: { params: Promise<{ id: string; contestId: string }> }) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const { id, contestId } = await context.params
  if (!UUID.test(id) || !UUID.test(contestId)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE })
  const rate = await checkDurableRateLimit(`research-election-tally:${auth.userId}`, 12, 60_000, { onUnavailable: "deny" })
  if (!rate.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rate) }, { status: durableRateLimitStatus(rate), headers: NO_STORE })
  const parsed = await readBoundedJson(request, 12 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_BODY" }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: NO_STORE })
  const body = parsed.value
  const geoUnitId = typeof body.geoUnitId === "string" ? body.geoUnitId : ""
  const pollingUnitCode = typeof body.pollingUnitCode === "string" ? body.pollingUnitCode.trim() : ""
  const candidateVotes = body.candidateVotes
  const parseRequiredCount = (value: unknown): number | null =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNT ? value : null
  const parseOptionalCount = (value: unknown): number | null | "invalid" => {
    if (value === null || value === undefined) return null
    const parsed = parseRequiredCount(value)
    return parsed === null ? "invalid" : parsed
  }
  const registeredParsed = parseOptionalCount(body.registeredVoters)
  const accreditedParsed = parseOptionalCount(body.accreditedVoters)
  const ballotsParsed = parseOptionalCount(body.totalBallots)
  const validParsed = parseRequiredCount(body.validVotes)
  const rejectedParsed = parseRequiredCount(body.rejectedBallots)
  if (!UUID.test(geoUnitId) || !pollingUnitCode || pollingUnitCode.length > 120 || /[\u0000-\u001f\u007f]/.test(pollingUnitCode) || registeredParsed === "invalid" || accreditedParsed === "invalid" || ballotsParsed === "invalid" || validParsed === null || rejectedParsed === null || !Array.isArray(candidateVotes) || candidateVotes.length < 1 || candidateVotes.length > 100) {
    return NextResponse.json({ ok: false, error: "INVALID_ELECTION_TALLY" }, { status: 400, headers: NO_STORE })
  }
  // The sentinel checks above establish these exact numeric/null types before arithmetic.
  const registeredVoters: number | null = registeredParsed
  const accreditedVoters: number | null = accreditedParsed
  const totalBallots: number | null = ballotsParsed
  const validVotes: number = validParsed
  const rejectedBallots: number = rejectedParsed
  const isCount = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNT
  const normalized: CandidateVote[] = []
  const seen = new Set<string>()
  for (const item of candidateVotes) {
    if (!item || typeof item !== "object" || typeof item.candidateId !== "string" || !UUID.test(item.candidateId) || !isCount(item.votes)) {
      return NextResponse.json({ ok: false, error: "INVALID_CANDIDATE_VOTES" }, { status: 400, headers: NO_STORE })
    }
    const candidateId = item.candidateId.toLowerCase()
    if (seen.has(candidateId)) return NextResponse.json({ ok: false, error: "DUPLICATE_CANDIDATE" }, { status: 400, headers: NO_STORE })
    seen.add(candidateId)
    normalized.push({ candidateId, votes: item.votes })
  }
  const candidateTotal = normalized.reduce((sum, item) => sum + item.votes, 0)
  if (!Number.isSafeInteger(candidateTotal) || candidateTotal !== validVotes) return NextResponse.json({ ok: false, error: "CANDIDATE_TOTAL_MISMATCH" }, { status: 422, headers: NO_STORE })
  if (registeredVoters !== null && accreditedVoters !== null && accreditedVoters > registeredVoters) return NextResponse.json({ ok: false, error: "ACCREDITED_EXCEEDS_REGISTERED" }, { status: 422, headers: NO_STORE })
  if (totalBallots !== null && (validVotes + rejectedBallots !== totalBallots || (accreditedVoters !== null && totalBallots > accreditedVoters))) return NextResponse.json({ ok: false, error: "BALLOT_TOTAL_MISMATCH" }, { status: 422, headers: NO_STORE })
  if (!getServiceSupabaseConfig()) return NextResponse.json({ ok: false, error: "RESEARCH_STORAGE_UNAVAILABLE" }, { status: 503, headers: NO_STORE })

  const result = await supabaseRpc<TallyResult>("gh_research_election_tally_submit", {
    p_project_id: id, p_contest_id: contestId, p_actor_user_id: auth.userId, p_geo_unit_id: geoUnitId,
    p_polling_unit_code: pollingUnitCode, p_registered_voters: registeredVoters, p_accredited_voters: accreditedVoters,
    p_total_ballots: totalBallots, p_valid_votes: validVotes, p_rejected_ballots: rejectedBallots,
    p_candidate_votes: normalized.map((item) => ({ candidate_id: item.candidateId, votes: item.votes })),
  }, { timeoutMs: 15_000 })
  if (!result.ok) return NextResponse.json({ ok: false, error: "ELECTION_TALLY_UNAVAILABLE" }, { status: 503, headers: NO_STORE })
  const data = result.data
  if (!data || typeof data !== "object" || data.ok !== true) {
    const code = typeof data?.code === "string" ? data.code : "ELECTION_TALLY_REJECTED"
    const status = code === "AGENT_NOT_ASSIGNED" || code === "CONTEST_NOT_ACTIVE" ? 403 : code === "IDEMPOTENCY_CONFLICT" ? 409 : code === "INVALID_TALLY" || code === "CANDIDATE_TOTAL_MISMATCH" ? 422 : 409
    return NextResponse.json({ ok: false, error: code }, { status, headers: NO_STORE })
  }
  return NextResponse.json({ ok: true, tallyId: data.tallyId, idempotent: Boolean(data.idempotent), reconciliationStatus: data.reconciliationStatus || "pending" }, { status: data.idempotent ? 200 : 201, headers: NO_STORE })
}
