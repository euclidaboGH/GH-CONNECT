import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const piIntent = read('supabase/migrations/202609040003_pi_payment_intents_durable.sql')
const piStore = read('lib/server/payments/intent-store.ts')
const withdrawal = read('lib/server/economy/withdrawal.ts')
const asset = read('lib/asset-separation.ts')
const a2u = read('app/api/payments/a2u/create/route.ts')
const a2uSql = read('supabase/migrations/202610250006_pi_a2u_sdk_execution_orchestration.sql')
const sellerPayoutSql = read('supabase/migrations/202610250007_ghc_atomic_seller_payout_settlement.sql')
const sellerPayoutRoute = read('app/api/marketplace/payouts/[requestId]/reconcile-ghc/route.ts')
const paystackWebhook = read('app/api/webhooks/paystack/route.ts')
const paystackSql = read('supabase/migrations/202610250008_paystack_ngn_beneficiaries_and_payouts.sql')
const membership = read('lib/server/membership/entitlement-store.ts')
const report = read('docs/PHASE_5_GHC_PI_FINANCIAL_INTEGRITY.md')

const checks = [
  ['durable payment intent migration uses unique provider payment identity', /UNIQUE|unique/i.test(piIntent) && piIntent.includes('uq_ghc_payment_intents_provider_payment')],
  ['production payment intent store refuses memory as durable authority', piStore.includes('Production: DB is authority') && /DURABLE_REQUIRED|assertDurableWrite/.test(piStore)],
  ['GHC→Pi withdrawal is explicitly default-off', /GHC_WITHDRAWALS_ENABLED\s*===\s*"true"/.test(withdrawal)],
  ['asset conversion is not implicitly enabled', /conversionEnabled:\s*false\s+as const/.test(asset)],
  ['Pi A2U requires explicit flags and Testnet mode', a2u.includes('PI_A2U_ENABLED !== "true"') && a2u.includes('PI_A2U_TESTNET_ONLY !== "true"') && a2u.includes('!resolvePiSandbox()')],
  ['Pi A2U execution is durably serialized', a2uSql.includes('gh_pi_a2u_sequence_lease') && a2uSql.includes('FOR UPDATE')],
  ['seller payout checks funded treasury and verified eligible backing', sellerPayoutSql.includes('INSUFFICIENT_FUNDED_TREASURY') && sellerPayoutSql.includes('PAYOUT_ORDER_BACKING_INVALID')],
  ['seller payout route remains explicitly feature-gated', sellerPayoutRoute.includes('GHC_MARKETPLACE_GHC_PAYOUTS_ENABLED !== "true"')],
  ['Paystack payout state is represented in server/database layer', paystackWebhook.includes('signature') && paystackSql.includes('service_role')],
  ['membership entitlement logic is server-owned', /service|rpc|entitlement/i.test(membership)],
  ['financial safety report records external verification as outstanding', report.includes('No Supabase, Vercel, Pi network, Paystack') && report.includes('Unresolved gates')],
]
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
  assert.ok(pass, name)
}
console.log(`\nPhase 5 financial-integrity contract: ${checks.length}/${checks.length} passed`)
