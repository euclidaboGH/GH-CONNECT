#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261022010073_reputation_event_integrity.sql'), 'utf8')
const policy = fs.readFileSync(path.join(root, 'docs/GREENHAVEN_REPUTATION_CURATION_POLICY.md'), 'utf8')
const route = fs.readFileSync(path.join(root, 'app/api/social/posts/[id]/curation/route.ts'), 'utf8')
const pipeline = fs.readFileSync(path.join(root, 'supabase/migrations/20261022010072_gh_curation_pipeline_atomic.sql'), 'utf8')
const selfVote = fs.readFileSync(path.join(root, 'supabase/migrations/20261022010075_allow_self_curation.sql'), 'utf8')
const levels = fs.readFileSync(path.join(root, 'lib/social-economy/reputation-levels.ts'), 'utf8')
const repSql = fs.readFileSync(path.join(root, 'supabase/migrations/20261022010046_gh_reputation.sql'), 'utf8')
const checks = [
  ['SQL trigger guards reputation event inserts/updates', /BEFORE INSERT OR UPDATE OF event_type, points/.test(migration)],
  ['Canonical profile completion points', /WHEN 'profile_complete' THEN 25/.test(migration)],
  ['Canonical first-post points', /WHEN 'first_post' THEN 15/.test(migration)],
  ['Canonical community join points', /WHEN 'community_join' THEN 10/.test(migration)],
  ['Canonical marketplace completion points', /WHEN 'marketplace_order_complete' THEN 20/.test(migration)],
  ['Canonical helpful report points', /WHEN 'report_resolved_helpful' THEN 5/.test(migration)],
  ['Unknown event types rejected', /Unsupported reputation event type/.test(migration)],
  ['Manual adjustment remains positive and explicit', /NEW.points <= 0/.test(migration)],
  ['Guard function not executable by public clients', /REVOKE ALL ON FUNCTION public\.gh_reputation_validate_event_points\(\) FROM PUBLIC, anon, authenticated/.test(migration)],
  ['Vote API uses server-authenticated identity', /resolveAuthenticatedUser/.test(route)],
  ['Curation weight is server-derived', /resolveWeightedVote/.test(route)],
  ['Percentage is passed to atomic vote/reward pipeline', /p_percentage: rewardPercentage/.test(route) && /p_curation_weight: weightedVote\.effectiveWeight/.test(route)],
  ['Active weight is percentage-scaled in SQL', /v_weight \* \(v_percentage \/ 100\)/.test(pipeline)],
  ['Pipeline documents no direct account-point mutation', /does not mutate account reputation directly/i.test(pipeline)],
  ['No retroactive ledger rewrite policy documented', /does not reverse, claw back, or add a second credit/.test(policy)],
  ['Raw vote is not immediate account reputation', /raw (upvotes|votes)/i.test(policy)],
  ['GHC and GHPV are separate', /GHPV settlement never mints GHC/.test(policy)],
  ['Testnet-only rollout documented', /testnet only/i.test(policy)],
  ['Self-curation is allowed and never counts as independent settlement evidence', /Author may self-curate/.test(selfVote) && /self-curation is never reward or independent-settlement evidence/i.test(selfVote)],
  ['Self-curation RPC keeps normal toggle/mutation behavior', /INSERT INTO public.gh_post_curations/.test(selfVote) && /gh_curate:/.test(selfVote)],
  ['Self-vote guard uses server-side post author', /SELECT author_id, visibility INTO v_author, v_visibility/.test(selfVote)],
  ['Self-vote RPC remains service-role only', /GRANT EXECUTE ON FUNCTION public\.gh_post_curation_set\(text, text, text\) TO service_role/.test(selfVote)],
  ['Curation API maps self-vote rejection to 403', /err === \"FORBIDDEN\" \|\| err === \"SELF_CURATION_FORBIDDEN\"/.test(route)],
  ['Raw votes cannot directly award account reputation', /Raw upvotes\/downvotes .*do not award or deduct account-reputation points/.test(policy)],
  ['Rank thresholds increase progressively in TypeScript', /minPoints: 30000/.test(levels) && /minPoints: 22000/.test(levels) && /minPoints: 25/.test(levels)],
  ['SQL reputation levels match the progressive top thresholds', /p_points >= 30000 THEN 15/.test(repSql) && /p_points >= 22000 THEN 14/.test(repSql)],
  ['80/20 quality/social target and safe activity caps documented', /80% quality and reputable system activity, 20% social interaction/.test(policy) && /per-day caps/.test(policy)],
  ['Curation reputation bridge remains gated until corrections are safe', /awards remain gated off/.test(policy)],
  ['Curation calibration affects influence separately from account reputation', /Settled judgment quality is reflected in curator calibration/.test(policy)],
  ['Wallet balance does not grant voting influence', /Wallet balance must not grant voting influence/.test(policy)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nREPUTATION/CURATION INTEGRITY: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
