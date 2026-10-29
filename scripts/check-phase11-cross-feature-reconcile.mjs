#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mod = read('lib/server/economy/cross-feature-reconcile.ts')
const api = read('app/api/economy/wallet/cross-reconcile/route.ts')
const dash = read('components/ghc/unified-earnings-dashboard.tsx')
const payments = existsSync(join(root, 'app/api/payments/reconciliation/route.ts'))
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Cross-feature reconcile module exists', existsSync(join(root, 'lib/server/economy/cross-feature-reconcile.ts')))
test('Read-only report builder (no ledger writes)', /buildCrossFeatureReconcileReport/.test(mod) && !/postEarningsCredit/.test(mod) && !/INSERT/.test(mod))
test('Composes PI earnings + charity + asset separation', /getWithdrawableBalance/.test(mod) && /getCharityUserSummary/.test(mod) && /ASSET_POLICY/.test(mod) || /ghcAndPiSeparated/.test(mod))
test('Charity marked not withdrawable', /withdrawable: false/.test(mod) || /charityNotWithdrawable/.test(mod))
test('Auth-only GET cross-reconcile API', /resolveAuthenticatedUser/.test(api) && /export async function GET/.test(api))
test('API is readOnly in response', /readOnly: true/.test(api))
test('Existing Pi payments reconciliation remains', payments)
test('Dashboard surfaces attention findings', /cross-reconcile/.test(dash) && /Cross-feature attention/.test(dash))
test('Related endpoints listed for operators', /\/api\/payments\/reconciliation/.test(mod))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 11 cross-feature reconcile: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
