#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const migration = readFileSync('supabase/migrations/20261110170001_function_search_path_hardening.sql', 'utf8')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const checks = [
  ['pins ghc_available_balance to pg_catalog', /ALTER FUNCTION public\.ghc_available_balance\(text\) SET search_path = pg_catalog/.test(migration)],
  ['pins gh_reputation_level_from_points to pg_catalog', /ALTER FUNCTION public\.gh_reputation_level_from_points\(integer\) SET search_path = pg_catalog/.test(migration)],
  ['does not rewrite function bodies or financial data', !/CREATE OR REPLACE FUNCTION|UPDATE public\.|DELETE FROM public\./.test(migration)],
  ['is transactional and idempotent', /BEGIN;/.test(migration) && /COMMIT;/.test(migration) && (migration.match(/ALTER FUNCTION/g) || []).length === 2],
  ['check is registered once in prebuild and static verification', ['prebuild:checks', 'verify:static'].every(k => (pkg.scripts[k].match(/check-run252-function-search-path\.mjs/g) || []).length === 1)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nRun #252 function search-path hardening: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
