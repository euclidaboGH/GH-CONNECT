#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const sql=readFileSync('supabase/migrations/20261110200001_supporting_foreign_key_indexes.sql','utf8')
const pkg=JSON.parse(readFileSync('package.json','utf8'))
const expected=['gh_bank_payout_operator_actions (payout_request_id)','gh_bank_payout_requests (beneficiary_id)','gh_bank_payout_webhook_events (payout_request_id)','gh_charity_contributions (platform_entry_id)','gh_earnings_ledger_entries (related_entry_id)','gh_judgment_events (settlement_id)','gh_marketplace_refund_operations (adjustment_id)','gh_post_comments (parent_id)','gh_saves (post_id)','gh_seller_payout_correction_approvals (order_id)','ghc_connection_contexts (request_id)']
const checks=[
 ['creates all eleven advisor-confirmed FK indexes',expected.every(x=>sql.includes('ON public.'+x))],
 ['all indexes are non-unique and idempotent', (sql.match(/CREATE INDEX IF NOT EXISTS/g)||[]).length===11 && !/CREATE UNIQUE INDEX/.test(sql)],
 ['does not modify ledger/business rows or constraints', !/UPDATE |DELETE FROM|ALTER TABLE|DROP CONSTRAINT/.test(sql)],
 ['check is registered once in prebuild and static verification',['prebuild:checks','verify:static'].every(k=>(pkg.scripts[k].match(/check-run255-fk-indexes\.mjs/g)||[]).length===1)]
]
let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++}console.log(`\nRun #255 FK indexes: ${checks.length-failed}/${checks.length} passed`);assert.equal(failed,0)
