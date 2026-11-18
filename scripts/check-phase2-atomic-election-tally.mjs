import fs from 'node:fs'
const route = fs.readFileSync('app/api/research/projects/[id]/elections/[contestId]/tallies/route.ts', 'utf8')
const sql = fs.readFileSync('supabase/proposals/20261118_research_election_atomic_tally_submission.sql', 'utf8')
const checks = [
  ['tally endpoint derives actor from authenticated session', /resolveAuthenticatedUser/.test(route) && /p_actor_user_id: auth\.userId/.test(route)],
  ['tally endpoint validates project and contest UUIDs', /UUID\.test\(id\).*UUID\.test\(contestId\)/s.test(route)],
  ['tally endpoint applies durable fail-closed rate limiting', /research-election-tally:.*12, 60_000, \{ onUnavailable: "deny" \}/.test(route)],
  ['tally payload has a strict bounded request body', /readBoundedJson\(request, 12 \* 1024\)/.test(route)],
  ['polling unit identity is bounded and rejects control characters', /pollingUnitCode\.length > 120/.test(route) && /pollingUnitCode\)/.test(route)],
  ['voter counts are safe non-negative integers with a hard maximum', /Number\.isSafeInteger\(value\)/.test(route) && /MAX_COUNT = 1_000_000_000/.test(route)],
  ['candidate vote list is bounded and duplicate candidate IDs are rejected', /candidateVotes\.length > 100/.test(route) && /DUPLICATE_CANDIDATE/.test(route)],
  ['candidate totals must equal valid vote count', /candidateTotal !== validVotes/.test(route)],
  ['ballot totals and accreditation arithmetic are checked', /ACCREDITED_EXCEEDS_REGISTERED/.test(route) && /BALLOT_TOTAL_MISMATCH/.test(route)],
  ['tally write uses one database RPC rather than parent/child REST writes', /supabaseRpc<TallyResult>\("gh_research_election_tally_submit"/.test(route) && !/supabaseRest/.test(route)],
  ['database function pins search_path and uses one transaction', /SECURITY DEFINER\s+SET search_path = pg_catalog, public/.test(sql) && /BEGIN;[\s\S]*COMMIT;/.test(sql)],
  ['database function requires an active contest in the same project', /c\.id=p_contest_id AND c\.project_id=p_project_id/.test(sql) && /v_contest\.status <> 'active'/.test(sql)],
  ['database function verifies active geography, country and contest descendant scope', /g\.country_code=v_contest\.country_code AND g\.is_active/.test(sql) && /WITH RECURSIVE contest_scope/.test(sql)],
  ['database function verifies the submitting actor has a current scoped agent assignment', /a\.user_id=p_actor_user_id/.test(sql) && /a\.status IN \('accepted','active'\)/.test(sql) && /a\.geo_unit_id IS NULL OR a\.geo_unit_id=p_geo_unit_id/.test(sql)],
  ['candidate votes are constrained to active candidates in the same contest', /c\.contest_id=p_contest_id AND c\.is_active/.test(sql)],
  ['same-key retries serialize and return the original tally only for identical payloads', /pg_advisory_xact_lock/.test(sql) && /IDEMPOTENCY_CONFLICT/.test(sql) && /v_existing_votes=v_requested_votes/.test(sql)],
  ['tally parent, candidate rows and audit event are written atomically', /INSERT INTO public\.gh_research_tallies/.test(sql) && /INSERT INTO public\.gh_research_tally_candidate_votes/.test(sql) && /INSERT INTO public\.gh_research_audit_events/.test(sql)],
  ['database function denies public and authenticated execution and grants service role only', /REVOKE ALL ON FUNCTION public\.gh_research_election_tally_submit/.test(sql) && /TO service_role/.test(sql)],
  ['proposal explicitly depends on held Research Intelligence migration', /20261116182000_gh_research_intelligence_platform_foundation\.sql/.test(sql) && /REVIEW-REQUIRED/.test(sql)],
  ['endpoint never certifies tally and returns pending reconciliation state', /reconciliationStatus: data\.reconciliationStatus \|\| "pending"/.test(route)],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`Phase 2 atomic election tally: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
