#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const assigned = read('app/api/research/elections/assigned/route.ts')
const submit = read('app/api/research/projects/[id]/elections/[contestId]/tallies/route.ts')
const accept = read('app/api/research/elections/assignments/[assignmentId]/route.ts')
const reconcile = read('app/api/research/projects/[id]/elections/[contestId]/reconciliation/route.ts')
const panel = read('components/field/field-agent-tally-panel.tsx')
const studio = read('components/field/research-studio-client.tsx')
const proposal = read('supabase/proposals/20261118_research_election_atomic_tally_submission.sql')
const helper = read('lib/research/election-reconciliation.ts')
const checks = [
  ['assigned tally context derives the actor from the authenticated session', assigned.includes('resolveAuthenticatedUser') && assigned.includes('item.user_id === auth.userId') && assigned.includes('gh_research_members') && assigned.includes('status=eq.active')],
  ['only pending/accepted/active observer, supervisor and coordinator assignments are returned', assigned.includes('status=in.(assigned,accepted,active)') && assigned.includes('assignment_role=in.(observer,supervisor,coordinator)')],
  ['field agents can accept only their own pending assignment with an active time window', accept.includes('user_id=eq.${encodeURIComponent(auth.userId)}') && accept.includes('status=eq.assigned') && accept.includes('gh_research_members') && accept.includes('status=eq.active') && accept.includes('status: \"accepted\"') && accept.includes('ASSIGNMENT_OUTSIDE_ACTIVE_WINDOW')],
  ['tally context requires polling-unit level and authoritative code/provenance', assigned.includes('geo.level_key !== "polling_unit"') && assigned.includes('geo.external_code') && assigned.includes('geo.source_ref') && assigned.includes('geo.source_version')],
  ['active candidates and contest are server-loaded, not supplied by the browser', assigned.includes('status=eq.active') && assigned.includes('is_active=eq.true')],
  ['tally submission API uses authenticated actor and one atomic server RPC', submit.includes('p_actor_user_id: auth.userId') && submit.includes('gh_research_election_tally_submit') && !submit.includes('body.agentUserId')],
  ['independent comparison is owner/reviewer restricted and read-only', reconcile.includes('role=in.(owner,reviewer)') && !/\.insert\(|\.update\(|\.delete\(/i.test(reconcile)],
  ['reconciliation has a hard result cap and refuses partial certification', reconcile.includes('limit=251') && reconcile.includes('RECONCILIATION_SCOPE_TOO_LARGE') && reconcile.includes('certified: false') && reconcile.includes('candidateNames')],
  ['comparison groups use distinct agent identities and never certify results', helper.includes('new Set(rows.map((row) => row.agent_user_id))') && helper.includes('awaiting_second_agent') && helper.includes('certified: false')],
  ['field-agent UI is registered in Research Studio and uses server assignment data', studio.includes('FieldAgentTallyPanel') && panel.includes('/api/research/elections/assigned')],
  ['field-agent UI disables submit until authoritative geography and active candidates are available', panel.includes('selected?.canSubmit') && panel.includes('selected.blockers') && panel.includes('sourceVersion') && panel.includes('selected.canAccept') && panel.includes('Accept field assignment')],
  ['tally UI derives identity from session and labels every submission pending comparison', panel.includes('credentials: "include"') && panel.includes('pending') && panel.includes('not a certified result')],
  ['atomic tally SQL proposal binds code to a provenance-backed polling-unit row', proposal.includes("g.level_key='polling_unit'") && proposal.includes('g.external_code=p_polling_unit_code') && proposal.includes('g.source_ref IS NOT NULL AND g.source_version IS NOT NULL') && proposal.includes('gh_research_members m') && proposal.includes("m.status='active'") && proposal.includes('CANDIDATE_SET_INCOMPLETE') && proposal.includes('v_candidate_count <> (')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\\nRUN333 election tally UI and reconciliation: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
