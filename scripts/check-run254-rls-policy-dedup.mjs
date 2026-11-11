#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const sql=readFileSync('supabase/migrations/20261110190001_rls_policy_dedup_and_initplan_optimization.sql','utf8')
const pkg=JSON.parse(readFileSync('package.json','utf8'))
const names=['ghc_tx_select_own','ghc_req_select_party','ghc_economy_events_select_own','ghc_referral_attr_select_party','ghc_referral_codes_select_own','ghc_referral_rewards_select_own']
const drops=['ghc_events_select_own','ghc_public_identities_no_client_write','ghc_referral_attr_no_client_write','ghc_referral_codes_no_client_write','ghc_referral_rewards_no_client_write','ghc_req_no_client_mutate','ghc_transfer_requests_no_client_write','ghc_user_accounts_no_client_write']
const checks=[
 ['optimizes all seven advisor-flagged auth.uid policies',names.every(n=>new RegExp('ALTER POLICY '+n+'[\\s\\S]*?SELECT auth\\.uid\\(\\)').test(sql))],
 ['removes only the eight identified duplicate/false policies',drops.every(n=>sql.includes('DROP POLICY IF EXISTS '+n))],
 ['does not disable RLS or add client write policies',!/DISABLE ROW LEVEL SECURITY|CREATE POLICY/.test(sql)],
 ['keeps the single ghc_user_accounts deny-all policy intact',!sql.includes('DROP POLICY IF EXISTS ghc_user_accounts_deny_client_all')],
 ['check is registered once in prebuild and static verification',['prebuild:checks','verify:static'].every(k=>(pkg.scripts[k].match(/check-run254-rls-policy-dedup\.mjs/g)||[]).length===1)]
]
let failed=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++}
console.log(`\nRun #254 RLS policy cleanup: ${checks.length-failed}/${checks.length} passed`);assert.equal(failed,0)
