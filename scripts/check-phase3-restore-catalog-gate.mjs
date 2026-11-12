#!/usr/bin/env node
/** Static regression contract for the read-only post-restore PostgreSQL catalog gate. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const sql = readFileSync(join(root, 'supabase/VALIDATE-RESTORED-DATABASE.sql'), 'utf8')
const runbook = readFileSync(join(root, 'docs/PHASE-03-DATABASE-INTEGRITY-RECOVERY.md'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const checks = [
  ['catalog gate explicitly declares read-only transaction', /BEGIN TRANSACTION READ ONLY/i.test(sql)],
  ['gate verifies critical financial and identity tables', /ghc_transactions/.test(sql) && /ghc_payment_intents/.test(sql) && /gh_user_profiles/.test(sql)],
  ['gate fails if GreenHaven tables lack RLS', /NOT c\.relrowsecurity/.test(sql) && /RESTORE GATE FAIL: GreenHaven tables without RLS/.test(sql)],
  ['gate detects PUBLIC execute on SECURITY DEFINER routines', /aclexplode\(COALESCE\(p\.proacl, acldefault\('f', p\.proowner\)\)\)/.test(sql) && /acl\.grantee = 0/.test(sql)],
  ['gate detects SECURITY DEFINER routines without pinned search_path', /p\.prosecdef/.test(sql) && /search_path=/.test(sql)],
  ['gate reports unvalidated foreign keys and invalid indexes', /unvalidated_foreign_keys/.test(sql) && /invalid_indexes/.test(sql)],
  ['gate documents production prohibition', /never production/i.test(sql)],
  ['runbook describes the restore catalog gate', /VALIDATE-RESTORED-DATABASE\.sql/.test(runbook)],
  ['package exposes the catalog-gate check', pkg.scripts?.['check:phase3-restore-catalog-gate'] === 'node scripts/check-phase3-restore-catalog-gate.mjs'],
  ['SQL avoids known data/schema/role/grant mutation statements', !/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE)\b/im.test(sql)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Phase 3 restore catalog gate contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
