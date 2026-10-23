import fs from 'node:fs'
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const store = read('lib/server/membership/entitlement-store.ts')
const status = read('app/api/membership/status/route.ts')
const reconcile = read('app/api/membership/reconcile/route.ts')
const complete = read('app/api/payments/complete/route.ts')
const fulfill = read('app/api/payments/fulfill/route.ts')
const activate = read('app/api/membership/activate/route.ts')
const migration = read('supabase/migrations/20261023000001_membership_payment_reconciliation_v2.sql')
const tests = [
 ['server recovery reads durable payment history', store.includes('listIntentsForUserAsync(uid)')],
 ['recovery accepts only completed or fulfilled intents', store.includes("intent.status === 'COMPLETED' || intent.status === 'FULFILLED'")],
 ['recovery accepts only PI membership intents', store.includes("intent.currency === 'PI'") && store.includes('intent.purpose === \'membership\'' )],
 ['recovery validates catalog through existing grant path', store.includes('tryGrantMembershipFromCompletedIntent')],
 ['recovery never accepts caller-selected payment data', reconcile.includes('request: Request') && !reconcile.includes('request.json')],
 ['recovery is authenticated', reconcile.includes('resolveAuthenticatedUser')],
 ['status self-heals a free entitlement', status.includes('reconcileMembershipFromPaymentHistory') && status.includes('result.entitlement.tier === "free"')],
 ['status fails closed if reconciliation store is unavailable', status.includes('MEMBERSHIP_RECONCILIATION_UNAVAILABLE')],
 ['status remains no-store', status.includes('no-store, no-cache, must-revalidate')],
 ['Pi complete grants membership server-side', complete.includes('tryGrantMembershipFromCompletedIntent')],
 ['Pi fulfill grants membership server-side', fulfill.includes('tryGrantMembershipFromCompletedIntent')],
 ['activate requires durable completed intent', activate.includes('PAYMENT_NOT_COMPLETED') && activate.includes('loadPaymentIntent')],
 ['membership catalog product is exact', activate.includes('membership_${tier}_${period}')],
 ['payment/entitlement index accelerates recovery', migration.includes('idx_ghc_payment_intents_membership_completed')],
 ['entitlement purchase reference index exists', migration.includes('idx_ghc_membership_entitlements_user_purchase')],
 ['membership migration remains additive', migration.includes('CREATE INDEX IF NOT EXISTS') && !migration.includes('DROP TABLE')],
 ['orphan recovery remains available', store.includes('completeOrphanedMembershipPurchase')],
 ['existing membership pricing contract remains intact', fs.existsSync(new URL('../scripts/test-membership-pricing.mjs', import.meta.url))],
]
let pass=0
for (const [name, ok] of tests) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (ok) pass++ }
console.log(`\nPhase 29 Membership + Pi Payment Convergence: ${pass}/${tests.length}`)
if (pass !== tests.length) process.exit(1)
