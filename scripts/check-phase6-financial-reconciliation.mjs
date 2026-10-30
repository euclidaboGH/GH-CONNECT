#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mod = read('lib/server/economy/cross-feature-reconcile.ts')
const api = read('app/api/economy/wallet/cross-reconcile/route.ts')
const ui = read('components/ghc/unified-earnings-dashboard.tsx')
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
test('Phase 6 reconciliation module exists', existsSync(join(root, 'lib/server/economy/cross-feature-reconcile.ts')))
test('PI ledger and withdrawable snapshots both queried', /getEarningsBalances/.test(mod) && /getWithdrawableBalance/.test(mod))
test('Atomic values validated without floating point arithmetic', /function validAtomic/.test(mod) && /BigInt|validAtomic/.test(mod))
test('Available and reserved PI snapshots compared', /PI_BALANCE_SNAPSHOT_MISMATCH/.test(mod) && /PI_BALANCE_SNAPSHOTS_MATCH/.test(mod))
test('Cashback is probed from authoritative statement RPC', /gh_pi_cashback_user_statement/.test(mod) && /featureAvailable !== true/.test(mod))
test('Cashback unavailable fails closed', /CASHBACK_STATEMENT_UNAVAILABLE/.test(mod) && /featureAvailable: false/.test(mod))
test('Cashback no longer hardcoded available', !/featureAvailable: true,\s*error: undefined/.test(mod))
test('Charity remains segregated and non-withdrawable', /withdrawable: false/.test(mod) && /CHARITY_SEGREGATED/.test(mod))
test('PI and GHC asset separation retained', /ghcAndPiSeparated: true/.test(mod) && /ASSET_SEPARATION/.test(mod))
test('Report exposes explicit health state', /status: "healthy" \| "attention" \| "degraded"/.test(mod) && /status: findings/.test(mod))
test('API remains authenticated and read-only', /resolveAuthenticatedUser/.test(api) && /readOnly: true/.test(api) && /export async function GET/.test(api))
test('Dashboard renders healthy, attention and degraded states', /Financial snapshots reconciled/.test(ui) && /Cross-feature attention/.test(ui) && /Reconciliation unavailable/.test(ui))
const failed = checks.filter(x => !x).length
console.log(`\nPhase 6 financial reconciliation: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
