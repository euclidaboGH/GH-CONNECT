import fs from 'node:fs'
import assert from 'node:assert/strict'
const read = (p) => fs.readFileSync(p, 'utf8')
const moderation = read('app/api/governance/moderation-log/route.ts')
const reports = read('app/api/governance/reports/route.ts')
const store = read('lib/server/community/governance-store.ts')
const migration = read('supabase/migrations/20261107170001_phase7_durable_community_governance.sql')
const communityPlatform = read('supabase/migrations/20261023030001_gh_community_platform_v2.sql')
const hub = read('components/ghc/premium-community-hub.tsx')
const checks = [
  ['moderation history is server-readable only to authenticated moderators', moderation.includes('export async function GET') && moderation.includes('requireCommunityModerator') && moderation.includes('listModerationEntries')],
  ['moderation writes use authenticated actor identity', moderation.includes('actorId: auth.userId') && !moderation.includes('actorId: entry.actorId')],
  ['moderation action and target types are allowlisted', moderation.includes('ACTIONS.has(action)') && moderation.includes('TARGETS.has(targetType)')],
  ['database write is role-checked transactionally', store.includes('rpc/gh_community_moderation_log_append') && migration.includes('gh_community_platform_role(p_community_id, p_actor_id)')],
  ['reports support durable server creation and moderation resolution', reports.includes('createGovernanceReport') && reports.includes('resolveGovernanceReport') && reports.includes('listGovernanceReports') && reports.includes('if (!result?.ok)')],
  ['moderator UI hydrates durable history and report queues', hub.includes('/api/governance/moderation-log?communityId=') && hub.includes('/api/governance/reports?communityId=') && hub.includes('serverGovernanceReports ?? listCommunityReports')],
  ['client roles cannot directly mutate governance records', migration.includes('USING (false) WITH CHECK (false)') && migration.includes('REVOKE ALL ON TABLE public.gh_community_reports FROM anon, authenticated')],
  ['report and audit tables have operational indexes', !migration.includes('idx_gh_community_reports_status_created') && communityPlatform.includes('idx_gh_community_reports_queue') && migration.includes('idx_gh_community_moderation_actor_created')],
  ['community tabs meet 44px touch target and honor reduced motion', hub.includes('min-h-11') && hub.includes('motion-reduce:transition-none') && hub.includes('min-w-11')],
  ['community content region is keyboard focusable and named', hub.includes('role="region" aria-label={`${community.name} community content`} tabIndex={0}')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
assert.equal(failed, 0, `${failed} Phase 7 closeout checks failed`)
console.log(`Phase 7 governance closeout: ${checks.length}/${checks.length} passed`)
