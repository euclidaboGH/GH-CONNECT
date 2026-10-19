import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const a2u = read('app/api/payments/a2u/create/route.ts')
const ghcRoute = read('app/api/marketplace/payouts/[requestId]/reconcile-ghc/route.ts')
const transitionRoute = read('app/api/marketplace/payouts/[requestId]/transition/route.ts')
const piMigration = read('supabase/migrations/202610250006_pi_a2u_sdk_execution_orchestration.sql')
const ghcMigration = read('supabase/migrations/202610250007_ghc_atomic_seller_payout_settlement.sql')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['official Pi backend SDK pinned', pkg.dependencies['pi-backend'] === '0.1.3'],
  ['Pi A2U hard-gated to Testnet and explicit feature flag', a2u.includes('PI_A2U_ENABLED !== "true"') && a2u.includes('PI_A2U_TESTNET_ONLY !== "true"') && a2u.includes('!resolvePiSandbox()')],
  ['Pi private seed format is validated without exposing it', a2u.includes('PI_WALLET_PRIVATE_SEED') && a2u.includes('/^S[A-Z2-7]{55}$/')],
  ['SDK creates, submits and completes server-side A2U', a2u.includes('sdk.createPayment(') && a2u.includes('sdk.submitPayment(') && a2u.includes('sdk.completePayment(')],
  ['A2U recovery endpoint uses the SDK and durable payout execution binding', read('app/api/payments/a2u/complete/route.ts').includes('await import("pi-backend")') && read('app/api/payments/a2u/complete/route.ts').includes('DURABLE_A2U_EXECUTION_BINDING_REQUIRED')],
  ['A2U recovers incomplete payments before create', a2u.includes('sdk.getIncompleteServerPayments()') && a2u.includes('UNRELATED_INCOMPLETE_A2U_PAYMENT_REQUIRES_REVIEW')],
  ['A2U confirms recipient, exact amount, direction, network, metadata and txid', a2u.includes('payment.direction === "app_to_user"') && a2u.includes('payment.network === "Pi Testnet"') && a2u.includes('payment.user_uid === input.recipientUid') && a2u.includes('hasVerifiedTransaction')],
  ['A2U persists execution and globally serializes wallet sequence', piMigration.includes('gh_pi_a2u_executions') && piMigration.includes('gh_pi_a2u_sequence_lease') && piMigration.includes("interval '5 minutes'")],
  ['A2U execution RPCs are service-role only', piMigration.includes('GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_begin_execution(text,text,text) TO service_role') && piMigration.includes('FROM PUBLIC,anon,authenticated')],
  ['Phase 20 migration preflight is read-only and checks actual history', read('supabase/phase20_readonly_preflight.sql').includes('supabase_migrations.schema_migrations') && !/ALTER\s+TABLE|CREATE\s+OR\s+REPLACE\s+FUNCTION|UPDATE\s+public\./i.test(read('supabase/phase20_readonly_preflight.sql'))],
  ['Phase 20 post-migration assertions and concurrency plan exist', read('supabase/tests/PHASE20_POST_MIGRATION_ASSERTIONS.sql').includes('has_function_privilege') && read('supabase/tests/PHASE20_CONCURRENCY_TEST_PLAN.md').includes('crash immediately after SDK `createPayment`')],
  ['GHC seller payout is disabled unless explicitly enabled', ghcRoute.includes('GHC_MARKETPLACE_GHC_PAYOUTS_ENABLED !== "true"')],
  ['GHC payout requires configured treasury', ghcRoute.includes('GHC_MARKETPLACE_PAYOUT_TREASURY_USER_ID')],
  ['Payout lifecycle operator cannot mark payouts paid', transitionRoute.includes('GHC_PAYOUT_RECONCILIATION_KEY') && !transitionRoute.includes('p_next_status: "paid"') && transitionRoute.includes('only code paths')],
  ['GHC payout settlement atomically debits and credits ledger', ghcMigration.includes('ghc_spendable_balance') && ghcMigration.includes("'transfer_out'") && ghcMigration.includes("'transfer_in'")],
  ['GHC payout checks completed verified allocated orders', ghcMigration.includes('PAYOUT_ORDER_BACKING_INVALID') && ghcMigration.includes("o.payment_status<>'verified'")],
  ['GHC payout is idempotent and does not mint', ghcMigration.includes('PAYOUT_SETTLEMENT_CONFLICT') && ghcMigration.includes('UNIQUE') && ghcMigration.includes('INSUFFICIENT_FUNDED_TREASURY')],
  ['GHC payout marks paid in the same database transaction', ghcMigration.includes("SET status='paid',payout_reference=v_reference") && ghcMigration.includes('gh_seller_payout_ghc_settlements')],
  ['No secret is exposed through public environment prefixes', !/^NEXT_PUBLIC_.*(?:PI_API_KEY|PI_SERVER_API_KEY|PI_WALLET_PRIVATE_SEED|GHC_A2U_ADMIN_KEY|PAYOUT_RECONCILIATION_KEY)/m.test(read('.env.example'))],
]
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); assert.ok(pass, name) }
console.log(`\n${checks.length}/${checks.length} Phase 20 payout source checks passed.`)
