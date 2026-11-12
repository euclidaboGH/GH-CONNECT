#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const sourceMigration = read('supabase/migrations/20261023030002_gh_reputation_curation_intelligence_v2.sql')
const fixMigration = read('supabase/migrations/20261106080001_gh_reputation_intelligence_refresh_recovery.sql')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['base intelligence table uses user_id as its primary key and has no surrogate id', (() => { const table = sourceMigration.match(/CREATE TABLE IF NOT EXISTS public\.gh_reputation_intelligence\s*\(([\s\S]*?)\n\);/i)?.[1] || ''; return /user_id text PRIMARY KEY/i.test(table) && !/^\s*id\s+(?:uuid|text|bigint)\b/im.test(table) })()],
  ['historical refresh defect is present in the immutable source migration', /RETURNING id INTO v_id/.test(sourceMigration)],
  ['corrective refresh does not reference a nonexistent id column', !/RETURNING\s+id\s+INTO/i.test(fixMigration) && !/\bv_id\b/.test(fixMigration)],
  ['new users receive non-null reputation defaults when state rows are absent', /coalesce\(max\(total_points\),0\)[\s\S]*?coalesce\(max\(level\),1\)/.test(fixMigration)],
  ['new users receive non-null calibration defaults when calibration rows are absent', /coalesce\(max\(jcs\),50\)[\s\S]*?coalesce\(max\(integrity_score\),70\)/.test(fixMigration)],
  ['refresh continues to upsert the durable intelligence snapshot', /INSERT INTO public\.gh_reputation_intelligence\([\s\S]*?ON CONFLICT\(user_id\) DO UPDATE/.test(fixMigration)],
  ['refresh continues to append intelligence history', /INSERT INTO public\.gh_reputation_intelligence_history/.test(fixMigration)],
  ['RPC remains service-role-only', /REVOKE ALL ON FUNCTION public\.gh_reputation_intelligence_refresh\(text\) FROM PUBLIC, anon, authenticated[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_reputation_intelligence_refresh\(text\) TO service_role/.test(fixMigration)],
  ['correction does not add wallet, GHC ledger, or reward mutations', !/INSERT INTO public\.(?:ghc_ledger|ghc_transactions|ghc_user_accounts)|UPDATE public\.(?:ghc_user_accounts|ghc_wallets)|ghc_curation_reward_credit/.test(fixMigration)],
  ['regression gate is registered in prebuild and static verification', (pkg.scripts['prebuild:checks'] || '').includes('check-curation-intelligence-refresh-recovery.mjs') && (pkg.scripts['verify:static'] || '').includes('check-curation-intelligence-refresh-recovery.mjs')],
]
let passed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (ok) passed++ }
console.log(`\nCuration intelligence refresh recovery: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
