#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const sql=readFileSync('supabase/migrations/20261030010003_pi_earnings_payout_settlement_recovery.sql','utf8')
const create=readFileSync('supabase/migrations/20261030010002_pi_earnings_payout_requests.sql','utf8')
const checks=[
 ['settlement requires exact recipient binding',/p_recipient_uid <> v\.recipient_pi_app_uid/.test(sql)],
 ['settlement requires Testnet network binding',/p_network <> v\.network/.test(sql)&&/v\.network<>'Pi Testnet'/.test(sql)],
 ['settlement requires verified transaction and developer completion',/p_transaction_verified IS DISTINCT FROM true/.test(sql)&&/p_developer_completed IS DISTINCT FROM true/.test(sql)],
 ['settlement sends net amount but consumes gross reservation',/p_amount_pi - \(v\.net_atomic::numeric \/ 10000000\)/.test(sql)&&/gh_earnings_settle\(v\.user_id,v\.gross_atomic/.test(sql)],
 ['settlement and request state update share one transaction',/gh_earnings_settle[\s\S]*?UPDATE public\.gh_pi_earnings_payout_requests SET status='paid'/.test(sql)],
 ['paid retry requires identical provider receipt identifiers',/v\.provider_payment_id=p_provider_payment_id AND v\.provider_txid=p_provider_txid/.test(sql)],
 ['receipt mismatch blocks settlement',/PROVIDER_RECEIPT_MISMATCH/.test(sql)],
 ['release requires authoritative cancellation',/p_cancelled IS DISTINCT FROM true AND p_user_cancelled IS DISTINCT FROM true/.test(sql)],
 ['release requires no transaction',/p_has_transaction IS DISTINCT FROM false/.test(sql)],
 ['uncertain requests remain recoverable',/v\.status NOT IN \('reserved','processing','uncertain'\)/.test(sql)],
 ['release posts compensating ledger entry',/gh_earnings_release_reserve\(v\.user_id,v\.gross_atomic/.test(sql)],
 ['release cannot reverse paid requests',/IF v\.status='paid' THEN RETURN jsonb_build_object\('ok',false,'error','ALREADY_PAID'\)/.test(sql)],
 ['settlement RPC service role only',/REVOKE ALL ON FUNCTION public\.gh_pi_earnings_payout_settle_verified[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_pi_earnings_payout_settle_verified[\s\S]*?TO service_role/.test(sql)],
 ['release RPC service role only',/REVOKE ALL ON FUNCTION public\.gh_pi_earnings_payout_release_verified_failure[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_pi_earnings_payout_release_verified_failure[\s\S]*?TO service_role/.test(sql)],
 ['request creation keeps direct table access prohibited',/REVOKE ALL ON TABLE public\.gh_pi_earnings_payout_requests FROM PUBLIC, anon, authenticated, service_role/.test(create)],
]
let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++}console.log(`\nPI payout settlement/recovery contracts: ${checks.length-failed}/${checks.length} passed`);assert.equal(failed,0)
