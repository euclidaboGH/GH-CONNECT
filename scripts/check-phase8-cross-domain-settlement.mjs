#!/usr/bin/env node
/** Phase 8: cross-domain marketplace settlement and membership source contracts. */
import fs from 'node:fs'
const read = (path) => fs.readFileSync(path, 'utf8')
const commission = read('lib/server/marketplace/commission.ts')
const proceeds = read('supabase/migrations/20261030010009_phase20_marketplace_net_proceeds.sql')
const payRoute = read('app/api/marketplace/orders/[orderId]/pay/route.ts')
const membership = read('app/api/membership/activate/route.ts')
const membershipClient = read('lib/domains/membership-domain.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['application commission uses eight-decimal integer scaling', /gross\.toFixed\(8\)/.test(commission) && /100_000_000/.test(commission) && /BigInt/.test(commission)],
  ['SQL proceeds snapshot uses eight-decimal commission precision', /floor\(\(NEW\.total_amount \* v_bps \/ 10000\)::numeric \* 100000000\) \/ 100000000/.test(proceeds)],
  ['SQL seller proceeds snapshot remains immutable', /gh_marketplace_proceeds_reject_mutation/.test(proceeds) && /BEFORE UPDATE OR DELETE ON public\.gh_marketplace_order_proceeds/.test(proceeds)],
  ['PI marketplace payments remain bound to a verified owned intent and exact order amount', /intent\.provider !== "pi"/.test(payRoute) && /intent\.purpose !== "marketplace"/.test(payRoute) && /Math\.abs\(intent\.amount - order\.totalAmount\)/.test(payRoute)],
  ['GHC marketplace payment uses an order-scoped durable spend reference', /market_order_\$\{order\.id\}/.test(payRoute) && /ghc_execute_spend/.test(payRoute)],
  ['GHC membership purchase uses a per-attempt idempotency reference', /purchaseAttemptId/.test(membershipClient) && /spendReferenceId: `membership_\$\{tier\}_\$\{periodKey\}_\$\{purchaseAttemptId\}`/.test(membershipClient)],
  ['Pi membership requires exact catalog product and server-computed price', /getMembershipPiPrice\(tier, paidMonths\)\.chargePi/.test(membership) && /productId !== expected/.test(membership)],
  ['Phase 8 contract and runtime tests are in prebuild and verify:static', ['prebuild', 'verify:static'].every((key) => pkg.scripts?.[key]?.includes('check-phase8-cross-domain-settlement.mjs') && pkg.scripts?.[key]?.includes('test-phase8-cross-domain-settlement.mjs'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Phase 8 cross-domain settlement contract: ${checks.length}/${checks.length} passed.`)
