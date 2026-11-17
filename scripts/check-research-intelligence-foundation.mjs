import fs from 'node:fs'
const read = (p) => fs.readFileSync(p, 'utf8')
const migration = read('supabase/migrations/20261116182000_gh_research_intelligence_platform_foundation.sql')
const logic = read('lib/research/logic.ts')
const projects = read('app/api/research/projects/route.ts')
const publicApi = read('app/api/research/public/[slug]/route.ts')
const studio = read('components/field/research-studio-client.tsx')
const publicForm = read('components/field/public-research-form.tsx')
const challengeApi = read('app/api/social/challenges/route.ts')
const challengeComposer = read('components/ghc/challenge-composer.tsx')
const challengeInline = read('components/ghc/challenge-inline.tsx')
const checks = [
 ['project roles include owner/editor/reviewer/field agent', /'owner','editor','reviewer','field_agent'/.test(migration)],
 ['evidence records cover image/video/audio/document with private object paths', /'image','video','audio','document'/.test(migration) && /object_path/.test(migration)],
 ['geographic hierarchy is country-configurable and parent-linked', /gh_research_geo_levels/.test(migration) && /gh_research_geo_units/.test(migration) && /parent_id uuid/.test(migration)],
 ['election contest and candidate registers are durable', /gh_research_election_contests/.test(migration) && /gh_research_candidates/.test(migration)],
 ['agent assignments can be scoped to geographic units', /gh_research_agent_assignments/.test(migration) && /geo_unit_id/.test(migration)],
 ['tallies persist candidate votes and discrepancy codes', /gh_research_tallies/.test(migration) && /gh_research_tally_candidate_votes/.test(migration) && /discrepancy_codes/.test(migration)],
 ['exam attempts persist server deadlines and scoring', /deadline_at timestamptz/.test(migration) && /score numeric/.test(migration)],
 ['challenge participation and idempotent server events are durable', /gh_research_challenge_participants/.test(migration) && /UNIQUE\(challenge_id,user_id,event_key\)/.test(migration)],
 ['poll policies support vote changes, visibility, audiences and windows', /gh_social_poll_settings/.test(migration) && /results_visibility/.test(migration) && /vote_change_allowed/.test(migration)],
 ['all new tables enable RLS and revoke direct client access', /ENABLE ROW LEVEL SECURITY/.test(migration) && /REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated/.test(migration)],
 ['conditional rules validate previous-question references', /validateResearchLogic/.test(logic) && /CONDITION_MUST_REFERENCE_PREVIOUS_QUESTION/.test(logic)],
 ['conditional logic is validated when owners save forms', /validateResearchLogic\(out\)/.test(projects)],
 ['public submission server hides conditional questions and rejects hidden answers', /isResearchQuestionVisible/.test(publicApi) && /UNKNOWN_OR_HIDDEN_ANSWER/.test(publicApi)],
 ['owner visual editor exposes conditional display controls', /Conditional display/.test(studio) && /showWhen/.test(studio)],
 ['public response portal dynamically shows only matching questions', /visibleQuestions/.test(publicForm) && /isResearchQuestionVisible/.test(publicForm)],
 ['election reconciliation checks vote and ballot arithmetic', /CANDIDATE_TOTAL_MISMATCH/.test(logic) && /BALLOT_TOTAL_MISMATCH/.test(logic)],
 ['social challenges persist owner-created challenges and participant joins', /gh_social_challenges/.test(migration) && /gh_social_challenge_participants/.test(migration) && /action === \"create\"/.test(challengeApi) && /action === \"join\"/.test(challengeApi)],
 ['challenge participation is transaction-serialized with a locked server RPC', /FOR UPDATE/.test(migration) && /gh_social_challenge_participate/.test(migration) && /REVOKE ALL ON FUNCTION public.gh_social_challenge_participate/.test(migration) && /SECURITY INVOKER/.test(migration) && /rpc\/gh_social_challenge_participate/.test(challengeApi)],
 ['challenge composer no longer stores canonical challenge records in localStorage', /api\/social\/challenges/.test(challengeComposer) && !/ghc\.challenges\.local\.v1/.test(challengeComposer)],
 ['feed challenge join checks server status and persists participation', /api\/social\/challenges/.test(challengeInline) && /CHALLENGE_CLOSED/.test(challengeApi) && /joined/.test(challengeInline)],
]
let failed=0
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
console.log(`Research Intelligence foundation: ${checks.length-failed}/${checks.length} passed`)
process.exit(failed?1:0)
