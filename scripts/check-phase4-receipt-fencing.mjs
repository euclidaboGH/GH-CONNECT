#!/usr/bin/env node
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const route=readFileSync('app/api/economy/earnings/withdrawals/execute/route.ts','utf8')
const sql=readFileSync('supabase/migrations/20261030010006_pi_earnings_receipt_and_lease_fencing.sql','utf8')
const checks=[
 ['lease is revalidated before provider payment creation',route.includes('EXECUTION_LEASE_LOST_BEFORE_CREATE')],
 ['lease is revalidated before provider submission',route.includes('EXECUTION_LEASE_LOST_BEFORE_SUBMIT')],
 ['lease is revalidated before provider completion',route.includes('EXECUTION_LEASE_LOST_BEFORE_COMPLETE')],
 ['lease is revalidated before ledger settlement',route.includes('EXECUTION_LEASE_LOST_BEFORE_SETTLEMENT')],
 ['heartbeat locks request and global lane before extending either',sql.indexOf('FOR UPDATE')<sql.indexOf('UPDATE public.gh_pi_earnings_payout_requests')&&sql.indexOf('SELECT * INTO lane')<sql.indexOf('UPDATE public.gh_pi_a2u_execution_lane')],
 ['settlement validates provider payment identifier and metadata',sql.includes("p_receipt->>'identifier' IS DISTINCT FROM p_provider_payment_id")&&sql.includes("'pi_earnings'")&&sql.includes("payoutRequestId")],
 ['settlement validates A2U Testnet recipient and exact net amount',sql.includes("'app_to_user'")&&sql.includes("'Pi Testnet'")&&sql.includes('v_receipt_amount-(v.net_atomic::numeric/10000000)')],
 ['settlement validates transaction ID verification and completion',sql.includes("p_receipt->'transaction'->>'txid' IS DISTINCT FROM p_provider_txid")&&sql.includes('developer_completed')&&sql.includes('transaction_verified')],
 ['release validates receipt cancellation flags against RPC arguments',sql.includes('p_cancelled::text')&&sql.includes('p_user_cancelled::text')],
 ['release rejects transaction-bearing receipts',sql.includes("p_receipt->'transaction'->>'txid' IS NOT NULL")],
 ['privileged RPCs remain service-role only',sql.includes('GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_settle_verified')&&sql.includes('TO service_role;')&&sql.includes('REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_release_verified_failure')],
 ['ambiguous outcomes keep reservation',route.includes('reservationRetained:true')&&route.includes('p_uncertain:uncertain')],
 ['provider completion is skipped if already completed',route.includes('if(payment.status?.developer_completed!==true)')],
]
let failed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
console.log(`\nPhase 4 receipt/lease fencing: ${checks.length-failed}/${checks.length} passed`);assert.equal(failed,0)
