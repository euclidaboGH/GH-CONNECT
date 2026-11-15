#!/usr/bin/env node
/** Run #258: guard the production Marketplace order-list RPC alias regression. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/20261110110002_marketplace_orders_list_rpc_alias_fix.sql', 'utf8')
const orderStore = readFileSync('lib/server/marketplace/order-store.ts', 'utf8')
const checks = [
  ['hotfix replaces the existing user order-list RPC only', /CREATE OR REPLACE FUNCTION public\.gh_marketplace_orders_list_for_user\(p_user_id text\)/.test(migration)],
  ['ordering uses the real created_at column before JSON aggregation', /jsonb_agg\(public\.gh_marketplace_order_get\(o\.id\) ORDER BY o\.created_at DESC\)/.test(migration)],
  ['the function rejects empty or oversized user identifiers', /length\(v_user_id\) NOT BETWEEN 1 AND 160/.test(migration)],
  ['the result is bounded to the newest 200 matching orders', /ORDER BY created_at DESC\s+LIMIT 200/.test(migration)],
  ['the RPC delegates row projection to the existing order getter', /public\.gh_marketplace_order_get\(o\.id\)/.test(migration)],
  ['the function pins a safe search path', /SET search_path = pg_catalog, public/.test(migration)],
  ['the function is service-role only', /REVOKE ALL ON FUNCTION public\.gh_marketplace_orders_list_for_user\(text\)\s+FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_marketplace_orders_list_for_user\(text\)\s+TO service_role/.test(migration)],
  ['the server still uses the durable RPC and does not fall back to memory when DB configured', /rpcJson\("gh_marketplace_orders_list_for_user"/.test(orderStore) && /never treat process/.test(orderStore) && /memory as cross-instance durable history/.test(orderStore)],
  ['the hotfix does not mutate marketplace orders or payment ledgers', !/\b(INSERT INTO|UPDATE public\.gh_marketplace_orders|DELETE FROM|ghc_execute_spend|gh_pi_earnings_payout)\b/i.test(migration)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nRun #258 Marketplace order-list RPC hotfix: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
