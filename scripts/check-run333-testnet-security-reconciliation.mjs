#!/usr/bin/env node
/** Source contract for RUN333's narrowly scoped, already-applied Testnet grant revocation. */
import { readFileSync, existsSync } from 'node:fs'

const read = (path) => {
  const archived = `docs/archive/historical-implementation-records/docs__${path.slice('docs/'.length)}`
  return readFileSync(existsSync(path) ? path : archived, 'utf8')
}
const migrationPath = 'supabase/migrations/20261118033839_revoke_client_select_on_server_only_tables.sql'
const migration = read(migrationPath)
const order = read('supabase/TESTNET_APPLY_ORDER.md')
const report = read('docs/RUN333-TESTNET-SECURITY-RECONCILIATION-2026-11-18.md')
const truth = read('docs/SOURCE_OF_TRUTH.md')
const finalAudit = read('lib/server/release/final-audit.ts')
const runtimeTest = read('scripts/test-run333-final-audit-env.mjs')
const expected = [
  'gh_verification_requests', 'ghc_account_flags', 'ghc_community_moderation_log',
  'ghc_community_reports', 'ghc_connection_contexts', 'ghc_connection_requests',
  'ghc_match_signals', 'ghc_user_blocks',
]
const checks = []
const check = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

check('canonical migration file exists', existsSync(migrationPath))
check('migration only revokes client SELECT', /REVOKE SELECT ON TABLE/.test(migration) && /FROM PUBLIC, anon, authenticated/.test(migration))
check('migration does not grant new access or create permissive policies', !/^\s*GRANT\b/im.test(migration) && !/^\s*CREATE\s+POLICY\b/im.test(migration))
check('migration does not mutate application rows or drop schema objects', !/^\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/im.test(migration))
check('migration covers exactly the eight reviewed server-only tables', expected.every((name) => migration.includes(`public.${name}`)) && (migration.match(/public\.gh[a-z0-9_]+/g) || []).length === expected.length)
check('Testnet apply-order classifies this migration as already applied to Testnet only', order.includes('20261118033839_revoke_client_select_on_server_only_tables.sql') && order.includes('APPLIED_TESTNET_ONLY_HOLD_OTHER_TARGETS'))
check('postflight report records 46 Testnet migration entries and privilege preservation', /46 entries/.test(report) && /service_role` retains SELECT, INSERT, UPDATE, and DELETE/.test(report))
check('source-of-truth records RUN333 as the current Testnet state', /RUN333 — Existing Testnet security reconciliation/.test(truth) && /46 entries/.test(truth))
check('final release audit uses blockchain network, not PI API mode, for Mainnet separation', /process\.env\.PI_NETWORK === \"testnet\"/.test(finalAudit) && /PI_ENV=.*Pi Platform API mode/.test(finalAudit) && !/process\.env\.PI_ENV === \"mainnet\"/.test(finalAudit))
check('final release audit reports the canonical application release version and avoids stale migration counts', /releaseVersion: APP_RELEASE_VERSION/.test(finalAudit) && !/131-migration/.test(finalAudit) && /APP_RELEASE_VERSION/.test(finalAudit))
check('runtime regression tests cover Testnet API-production semantics and Mainnet network gating', existsSync('scripts/test-run333-final-audit-env.mjs') && /PI_NETWORK.*testnet/.test(runtimeTest) && /PI_NETWORK.*mainnet/.test(runtimeTest))

const passed = checks.filter(Boolean).length
console.log(`\nRUN333 Testnet security reconciliation: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
