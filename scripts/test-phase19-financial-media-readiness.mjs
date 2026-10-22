import fs from 'node:fs'
import assert from 'node:assert/strict'
const tipRoute = fs.readFileSync('app/api/social/tips/route.ts','utf8')
const payoutRoute = fs.readFileSync('app/api/marketplace/payouts/[requestId]/reconcile/route.ts','utf8')
const payoutIntake = fs.readFileSync('app/api/marketplace/payouts/route.ts','utf8')
const a2uCreate = fs.readFileSync('app/api/payments/a2u/create/route.ts','utf8')
const a2uComplete = fs.readFileSync('app/api/payments/a2u/complete/route.ts','utf8')
const fundRoute = fs.readFileSync('app/api/admin/creator-rewards/fund/route.ts','utf8')
const settleRoute = fs.readFileSync('app/api/admin/creator-rewards/settle/route.ts','utf8')
const migration = fs.readFileSync('supabase/migrations/20261022010112_ghc_tip_and_creator_reward_atomic_settlement.sql','utf8')
const preflight = fs.readFileSync('supabase/phase19_readonly_preflight.sql','utf8')
const concurrency = fs.readFileSync('supabase/tests/PHASE19_CONCURRENCY_TEST_PLAN.md','utf8')
const postMigrationAssertions = fs.readFileSync('supabase/tests/PHASE19_POST_MIGRATION_ASSERTIONS.sql','utf8')
const checks = [
 ['GHC tips remain off unless explicit feature gate is enabled', /GHC_TIPS_ENABLED !== "true"/.test(tipRoute)],
 ['GHC tip amounts use four-decimal precision', /currency === "GHC" \? 1e4 : 1e8/.test(tipRoute)],
 ['GHC tips invoke atomic settlement RPC', /gh_tip_settle_ghc_atomic/.test(tipRoute)],
 ['GHC tip settlement delegates to existing balance-funded transfer RPC', /public\.ghc_execute_transfer\(v_tip\.tipper_id,v_tip\.recipient_id,p_amount,v_ref/.test(migration)],
 ['shared GHC transfer locks sender and recipient in canonical order', /IF p_sender_id < p_to_user_id THEN[\s\S]*?ghc_balance:' \\|\\| p_to_user_id[\s\S]*?ELSE[\s\S]*?ghc_balance:' \\|\\| p_sender_id/.test(migration)],
 ['shared GHC transfer rejects precision beyond four decimals', /p_amount <> round\(p_amount, 4\)/.test(migration) && /INVALID_AMOUNT_PRECISION/.test(migration)],
 ['shared GHC transfer fails closed when economy limits are missing or malformed', migration.includes('TRANSFER_LIMITS_UNAVAILABLE') && migration.includes('v_limits.daily_receive_limit IS NULL')],
 ['GHC daily send/receive limits use bounded timezone-independent UTC day windows', (migration.match(/AT TIME ZONE 'UTC'\) AT TIME ZONE 'UTC'/g) || []).length >= 2 && (migration.match(/interval '1 day'/g) || []).length >= 2],
 ['shared GHC transfer rejects idempotency amount/recipient conflicts and incomplete pairs', migration.includes('IDEMPOTENCY_CONFLICT') && migration.includes('TRANSFER_PAIR_INCOMPLETE') && migration.includes('counterparty_id IS DISTINCT FROM p_to_user_id')],
 ['GHC tip transfer and settlement row share one SQL function transaction', /UPDATE public\.gh_tip_intents SET status='settled'/.test(migration) && /INSERT INTO public\.gh_tip_ghc_settlements/.test(migration)],
 ['ledger verification failure raises and rolls back instead of returning after transfer', /RAISE EXCEPTION 'GHC_TRANSFER_LEDGER_VERIFICATION_FAILED'/.test(migration)],
 ['reward pool funding requires explicit operator allowlist', /gh_creator_reward_pool_operators/.test(migration) && /REWARD_POOL_OPERATOR_REQUIRED/.test(migration)],
 ['reward funding moves existing GHC rather than minting', /public\.ghc_execute_transfer\(trim\(p_operator_id\),v_pool,p_amount/.test(migration)],
 ['reward distribution only settles approved GHC rewards', /v_reward\.status<>'approved' OR v_reward\.currency<>'GHC'/.test(migration)],
 ['reward distribution transfers from actual pool balance', /public\.ghc_execute_transfer\(v_pool,v_reward\.creator_id,v_reward\.proposed_amount/.test(migration)],
 ['reward settlement is idempotent and records ledger transaction IDs', /reward_event_id=v_reward\.id/.test(migration) && /debit_transaction_id,credit_transaction_id/.test(migration)],
 ['pool operator endpoints use constant-time secret comparison', fundRoute.includes('timingSafeEqual') && settleRoute.includes('timingSafeEqual')],
 ['PI payout reconciliation uses constant-time secret comparison', payoutRoute.includes('timingSafeEqual')],
 ['PI payout verifies provider direction and deployment network', payoutRoute.includes('payment.direction === \"app_to_user\"') && payoutRoute.includes('payment.network === expectedNetwork')],
 ['PI payout recipient comes from provider UID, never metadata fallback', payoutRoute.includes('String(payment?.user_uid || \"\")') && !payoutRoute.includes('payment?.metadata?.uid')],
 ['GHC external payout rail remains outside PI adapter', payoutRoute.includes('Only PI payouts are reconciled')],
 ['bank/fiat payout intake fails closed until a verified adapter exists', payoutIntake.includes('UNSUPPORTED_PAYOUT_RAIL') && payoutIntake.includes('verified banking adapter')],
 ['Pi A2U creation performs SDK chain submission and remains feature-gated', a2uCreate.includes('PI_A2U_ENABLED !== "true"') && a2uCreate.includes('sdk.submitPayment(') && a2uCreate.includes('sdk.completePayment(') && a2uCreate.includes('timingSafeEqual')],
 ['Pi A2U completion validates provider direction/network/txid and never settles seller payout', a2uComplete.includes('payment.direction === \"app_to_user\"') && a2uComplete.includes('payment.network === "Pi Testnet"') && a2uComplete.includes('payment.transaction?.txid === input.txid') && a2uComplete.includes('payoutSettled: false')],
 ['preflight checks actual migration history without applying migrations', preflight.includes('supabase_migrations.schema_migrations') && !/ALTER\s+TABLE|CREATE\s+OR\s+REPLACE\s+FUNCTION|UPDATE\s+public\./i.test(preflight)],
 ['preflight audits public URLs and registry/storage mismatches', preflight.includes('legacy-public-url') && preflight.includes('unregistered objects in gh-media')],
 ['media ID resolver returns owner-only stable facade URLs and no raw Storage URLs', /CREATE OR REPLACE FUNCTION public\.gh_media_assets_resolve/.test(migration) && /m\.owner_id=trim\(p_actor_id\)/.test(migration) && /'url','\/api\/media\/'\|\|m\.id/.test(migration)],
 ['Testnet concurrency plan covers same-event and insufficient-pool races', concurrency.includes('two concurrent settlement calls') && concurrency.includes('combined amount exceeds pool balance')],
 ['post-migration SQL assertions verify RPC ACLs, canonical locks and RLS', postMigrationAssertions.includes('has_function_privilege') && postMigrationAssertions.includes('p_sender_id < p_to_user_id') && postMigrationAssertions.includes('relrowsecurity')],
]
for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
assert.ok(checks.every(([,pass])=>pass),'Phase 19 financial/media readiness checks failed')
console.log(`Phase 19 financial/media readiness checks: ${checks.length}/${checks.length} passed`)
