#!/usr/bin/env node
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const route=readFileSync('app/api/economy/earnings/withdrawals/execute/route.ts','utf8')
const sql=readFileSync('supabase/migrations/20261030010004_pi_earnings_payout_execution_worker.sql','utf8')
const heartbeatSql=readFileSync('supabase/migrations/20261030010005_pi_earnings_payout_worker_lease_heartbeat.sql','utf8')
const checks=[
 ['dedicated authenticated general earnings route',route.includes('resolveAuthenticatedUser')&&route.includes('gh_pi_earnings_payout_requests')],
 ['explicit server-side operator authorization',route.includes('PI_EARNINGS_EXECUTOR_KEY')&&route.includes('timingSafeEqual')],
 ['execution disabled unless Testnet flags align',route.includes('PI_EARNINGS_PAYOUT_EXECUTION_ENABLED')&&route.includes('PI_A2U_TESTNET_ONLY')&&route.includes('resolvePiSandbox()')],
 ['recipient derived from durable request',route.includes('recipient_pi_app_uid')&&route.includes('begin.recipientUid')],
 ['wallet authorization checked',route.includes('assertPayoutWalletAuthorization')],
 ['global execution lease acquired before provider call',route.indexOf('gh_pi_earnings_payout_begin_execution')<route.indexOf('import("pi-backend")')],
 ['provider payment is durably bound before submit',route.indexOf('gh_pi_earnings_payout_bind_provider_payment')<route.indexOf('sdk.submitPayment')],
 ['existing incomplete payments recovered before creating',route.indexOf('getIncompleteServerPayments')<route.indexOf('sdk.createPayment')],
 ['unrelated incomplete payment blocks duplicate create',route.includes('UNRELATED_INCOMPLETE_A2U_REQUIRES_OPERATOR_REVIEW')],
 ['payment metadata binds payout request and domain',route.includes('payoutRequestId:requestId')&&route.includes('domain:"pi_earnings"')],
 ['provider payment binding independently checked',route.includes('sdk.getPayment(paymentId)')&&route.includes('PROVIDER_PAYMENT_BINDING_MISMATCH')],
 ['read-after-write receipt required before settlement',route.includes('Independent read-after-write')&&route.includes('INDEPENDENT_PROVIDER_RECEIPT_MISMATCH')],
 ['settlement uses verified provider receipt',route.includes('gh_pi_earnings_payout_settle_verified')&&route.includes('p_transaction_verified:true')],
 ['ambiguous failures retain reservation',route.includes('reservationRetained:true')&&route.includes('p_uncertain:uncertain')],
 ['worker lease uses durable ten-minute expiry',heartbeatSql.includes("interval '10 minutes'")],
 ['heartbeat RPC extends only the active request and global lease',heartbeatSql.includes('gh_pi_earnings_payout_heartbeat_execution')&&heartbeatSql.includes('EXECUTION_LEASE_LOST')&&heartbeatSql.includes('GLOBAL_EXECUTION_LEASE_LOST')],
 ['route heartbeats during long provider work',route.includes('setInterval')&&route.includes('gh_pi_earnings_payout_heartbeat_execution')&&route.includes('clearInterval(heartbeatTimer)')],
 ['provider completion is not repeated when already confirmed',route.includes('if(payment.status?.developer_completed!==true)')],
 ['execution request body is bounded',route.includes('readBoundedJson(request,8*1024)')],
 ['provider payment ID cannot be rebound',sql.includes('PROVIDER_PAYMENT_CONFLICT')],
 ['all worker RPCs service-role only',/REVOKE ALL ON FUNCTION public\.gh_pi_earnings_payout_begin_execution[\s\S]*?GRANT EXECUTE ON FUNCTION public\.gh_pi_earnings_payout_begin_execution[\s\S]*?TO service_role/.test(sql)&&sql.includes('TO service_role;')&&heartbeatSql.includes('GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_heartbeat_execution')],
]
let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++}console.log(`\nPI earnings execution worker contracts: ${checks.length-failed}/${checks.length} passed`);assert.equal(failed,0)
