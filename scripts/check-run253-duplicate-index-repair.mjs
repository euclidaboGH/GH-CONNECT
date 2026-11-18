#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const read = (p) => readFileSync(p, 'utf8')
const cleanup = read('supabase/migrations/20261110180001_remove_verified_duplicate_indexes.sql')
const dailyClaim = read('supabase/migrations/20261022010009_economy_v12_atomic_daily_claim.sql')
const pending = read('supabase/migrations/20261022010029_ghc_stage_pending.sql')
const governance = read('supabase/migrations/20261107170001_phase7_durable_community_governance.sql')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['removes only the duplicate earned-credit index while retaining the canonical index', /DROP INDEX IF EXISTS public\.uq_ghc_earned_user_ref/.test(cleanup) && /uq_ghc_earned_posted_ref/.test(dailyClaim) && !/CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_earned_user_ref/.test(pending)],
  ['removes only the duplicate community queue index while retaining the canonical index', /DROP INDEX IF EXISTS public\.idx_gh_community_reports_status_created/.test(cleanup) && /idx_gh_community_reports_queue/.test(read('supabase/migrations/20261023030001_gh_community_platform_v2.sql')) && !/CREATE INDEX IF NOT EXISTS idx_gh_community_reports_status_created/.test(governance)],
  ['does not drop or rewrite financial ledger rows', !/DELETE FROM public\.ghc_transactions|UPDATE public\.ghc_transactions/.test(cleanup)],
  ['cleanup is idempotent', /DROP INDEX IF EXISTS/.test(cleanup)],
  ['check is registered once in prebuild and static verification', ['prebuild:checks','verify:static'].every(k => (pkg.scripts[k].match(/check-run253-duplicate-index-repair\.mjs/g)||[]).length===1)],
]
let failed=0
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++ }
console.log(`\nRun #253 duplicate index cleanup: ${checks.length-failed}/${checks.length} passed`)
assert.equal(failed,0)
