import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const pricing = readFileSync(join(root, 'lib/membership-pricing.ts'), 'utf8')
const piCatalog = readFileSync(join(root, 'lib/gh-pay/catalog.ts'), 'utf8')
const piTypes = readFileSync(join(root, 'lib/gh-pay/types.ts'), 'utf8')
const piClient = readFileSync(join(root, 'lib/gh-pay/client.ts'), 'utf8')
const serverCatalog = readFileSync(join(root, 'lib/server/membership/entitlement-store.ts'), 'utf8')
const domain = readFileSync(join(root, 'lib/domains/membership-domain.ts'), 'utf8')
const server = readFileSync(join(root, 'lib/server/membership/entitlement-store.ts'), 'utf8')
const spend = readFileSync(join(root, 'lib/server/economy/spend-catalog.ts'), 'utf8')
const ui = readFileSync(join(root, 'components/ghc/premium-membership-screen.tsx'), 'utf8')
const activateRoute = readFileSync(join(root, 'app/api/membership/activate/route.ts'), 'utf8')
const atomicMigration = readFileSync(join(root, 'supabase/migrations/20261022010078_atomic_membership_purchase.sql'), 'utf8')
const roadmap = readFileSync(join(root, 'GREENHAVEN_GHC_ECONOMY_AND_FEES_ROADMAP_2026-10-18.md'), 'utf8')
const options = [
  { months: 1, discount: 0, vip: 150, vvip: 300, access: 2 },
  { months: 4, discount: 5, vip: 570, vvip: 1140, access: 5 },
  { months: 8, discount: 10, vip: 1080, vvip: 2160, access: 9 },
  { months: 12, discount: 20, vip: 1440, vvip: 2880, access: 13 },
]
for (const p of options) {
  const vipList = 150 * p.months
  const vvipList = 300 * p.months
  assert.equal(vipList - Math.round(vipList * p.discount / 100), p.vip)
  assert.equal(vvipList - Math.round(vvipList * p.discount / 100), p.vvip)
  assert.equal(p.access, p.months + 1)
}
assert.match(pricing, /MEMBERSHIP_PLAN_OPTIONS/)
assert.match(domain, /getMembershipGhcPrice\("vip", 12\)\.chargeGhc/)
assert.match(domain, /getMembershipGhcPrice\("vvip", 12\)\.chargeGhc/)
assert.match(server, /getMembershipGhcPrice\("vip", 12\)\.chargeGhc/)
assert.match(server, /getMembershipGhcPrice\("vvip", 12\)\.chargeGhc/)
assert.match(spend, /getMembershipGhcPrice\("vip", 12\)\.chargeGhc/)
assert.match(spend, /getMembershipGhcPrice\("vvip", 12\)\.chargeGhc/)
assert.match(ui, /vip: "1,440", vvip: "2,880"/)
assert.match(ui, /label: "4 months", discount: "5% off"/)
assert.match(ui, /label: "8 months", discount: "10% off"/)
assert.match(ui, /label: "12 months", discount: "20% off"/)
assert.match(activateRoute, /paidMonths: z\.union/)
assert.match(activateRoute, /getMembershipGhcPrice\(tier, paidMonths\)\.chargeGhc/)
assert.match(server, /four_months: 5/)
assert.match(server, /eight_months: 9/)
assert.match(server, /yearly: 13/)
assert.match(server, /addCalendarMonths\(now, accessMonths\)/)
assert.match(activateRoute, /rpcPurchaseMembership/)
assert.match(activateRoute, /ghc_purchase_membership/)
assert.match(atomicMigration, /ghc_execute_spend/)
assert.match(atomicMigration, /ghc_membership_upsert/)
assert.match(atomicMigration, /MEMBERSHIP_PURCHASE_RECONCILIATION_REQUIRED/)
assert.match(atomicMigration, /RAISE EXCEPTION 'MEMBERSHIP_ENTITLEMENT_WRITE_FAILED'/)
assert.match(atomicMigration, /GRANT EXECUTE ON FUNCTION public\.ghc_purchase_membership.*service_role/)
assert.match(ui, /getMembershipPiPrice\(tier as \"vip\" \| \"vvip\", period as PaidMembershipMonths\)/)
assert.match(roadmap, /one bonus month of membership/i)
assert.match(roadmap, /72 GHC/)
assert.match(pricing, /MEMBERSHIP_MONTHLY_PI = \{ vip: 1\.5, vvip: 3 \}/)
assert.match(pricing, /getMembershipPiPrice/)
assert.match(piCatalog, /membership_vip_four_months/)
assert.match(piCatalog, /membership_vip_eight_months/)
assert.match(piCatalog, /membership_vvip_four_months/)
assert.match(piCatalog, /membership_vvip_eight_months/)
assert.match(piTypes, /period: \"monthly\" \| \"four_months\" \| \"eight_months\" \| \"yearly\"/)
assert.match(piClient, /period: \"monthly\" \| \"four_months\" \| \"eight_months\" \| \"yearly\"/)
assert.match(serverCatalog, /fourMonthsPi: getMembershipPiPrice/)
assert.match(serverCatalog, /eightMonthsPi: getMembershipPiPrice/)
for (const [base, expected] of [[1.5, [1.5, 5.7, 10.8, 14.4]], [3, [3, 11.4, 21.6, 28.8]]]) {
  const piExpected = [base, base * 4 * 0.95, base * 8 * 0.9, base * 12 * 0.8].map((n) => Math.round(n * 100) / 100)
  assert.deepEqual(piExpected, expected)
}

assert.match(piClient, /f\.period === "eight_months" \? "eight_months"/)
assert.match(piClient, /f\.period === "four_months" \? "four_months"/)
assert.match(piClient, /period === "eight_months" \? "eight_months"/)
assert.match(piClient, /period === "four_months" \? "four_months"/)
assert.match(piClient, /productId\.includes\("eight_months"\)/)
assert.match(piClient, /productId\.includes\("four_months"\)/)
assert.match(readFileSync(join(root, 'components/ghc/gh-pay-panel.tsx'), 'utf8'), /VIP · 4 months/)
assert.match(readFileSync(join(root, 'components/ghc/gh-pay-panel.tsx'), 'utf8'), /VVIP · 8 months/)
for (const id of [
  'membership_vip_monthly', 'membership_vip_four_months', 'membership_vip_eight_months', 'membership_vip_yearly',
  'membership_vvip_monthly', 'membership_vvip_four_months', 'membership_vvip_eight_months', 'membership_vvip_yearly',
]) {
  const productBlock = piCatalog.slice(piCatalog.indexOf(`${id}:`), piCatalog.indexOf('active: true', piCatalog.indexOf(`${id}:`)) + 'active: true'.length)
  assert.ok(productBlock.includes('active: true'), `${id} must be active in Pi catalog`)
}

console.log('Membership pricing policy: GHC and Pi pricing, 8 active Pi products, 4-duration checkout/fulfillment and bonus access checks passed.')
