#!/usr/bin/env node
/** Source contract checks for transfer-request SECURITY DEFINER ACL hardening. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
const root = process.cwd()
const migration = await readFile(join(root, 'supabase/migrations/20261027010005_ghc_transfer_request_rpc_acl_hardening.sql'), 'utf8')
const checks = [
  ['fails migration if the expected function signature is absent', /to_regprocedure\('public\.ghc_create_transfer_request\(text,text,numeric,text,text\)'\)[\s\S]*?RAISE EXCEPTION/.test(migration)],
  ['sets a hardened explicit search path', /ALTER FUNCTION public\.ghc_create_transfer_request\(text, text, numeric, text, text\)\s+SET search_path = pg_catalog, public, pg_temp/.test(migration)],
  ['revokes default PUBLIC execution', /REVOKE ALL ON FUNCTION public\.ghc_create_transfer_request\([^;]+ FROM PUBLIC;/i.test(migration)],
  ['revokes anonymous execution', /REVOKE ALL ON FUNCTION public\.ghc_create_transfer_request\([^;]+ FROM anon;/i.test(migration)],
  ['revokes authenticated direct execution', /REVOKE ALL ON FUNCTION public\.ghc_create_transfer_request\([^;]+ FROM authenticated;/i.test(migration)],
  ['grants execution only to service_role in this migration', /GRANT EXECUTE ON FUNCTION public\.ghc_create_transfer_request\([^;]+ TO service_role;/i.test(migration) && !/GRANT EXECUTE ON FUNCTION public\.ghc_create_transfer_request\([^;]+ TO (anon|authenticated|PUBLIC);/i.test(migration)],
  ['wraps metadata changes in a transaction', /BEGIN;[\s\S]*COMMIT;\s*$/.test(migration)],
  ['does not perform ledger or balance mutations', !/INSERT\s+INTO\s+public\.ghc_transactions|UPDATE\s+public\.ghc_wallets|DELETE\s+FROM\s+public\.ghc_transactions/i.test(migration)],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`RESULT ${checks.length - failures}/${checks.length}`)
if (failures) process.exitCode = 1
