#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

const sql = read('supabase/migrations/20261030010015_phase26_operational_execution_paths.sql')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')

test('phase26 migration present', existsSync(join(root, 'supabase/migrations/20261030010015_phase26_operational_execution_paths.sql')))
test('refund request phase distinct from confirmed', /gh_marketplace_begin_refund_request/.test(sql) && /pending_provider/.test(sql) && /not treated as completed/.test(sql))
test('dispute decision RPC service-role only', /gh_marketplace_record_dispute_decision/.test(sql) && /GRANT EXECUTE[\s\S]*gh_marketplace_record_dispute_decision[\s\S]*service_role/.test(sql))
test('dispute adjustment does not claim provider refund', /notProviderRefund/.test(sql) || /does not prove provider/.test(sql) || /provider refund still requires/.test(sql))
test('payout correction approval does not mutate allocations', /does not mutate historical payout allocations/.test(sql))
test('payout correction apply uses adjustment only', /gh_seller_payout_correction_apply/.test(sql) && /original payout allocation rows unchanged/.test(sql))
test('TS refund module exists', existsSync(join(root, 'lib/server/marketplace/operational-refunds.ts')))
test('TS dispute module exists', existsSync(join(root, 'lib/server/marketplace/operational-disputes.ts')))
test('TS payout correction module exists', existsSync(join(root, 'lib/server/marketplace/operational-payout-corrections.ts')))
test('TS membership renewal workflow exists', existsSync(join(root, 'lib/server/membership/renewal-workflow.ts')))
test('operator refund route gated', /assertOperatorKey/.test(read('app/api/operator/operational/refunds/route.ts')))
test('operator dispute route gated', /assertOperatorKey/.test(read('app/api/operator/operational/disputes/route.ts')))
test('operator payout-corrections route gated', /assertOperatorKey/.test(read('app/api/operator/operational/payout-corrections/route.ts')))
test('operator membership-renew route gated', /assertOperatorKey/.test(read('app/api/operator/operational/membership-renew/route.ts')))
test('dry-run blocks unverified settlement', /SETTLEMENT_NOT_EXTERNALLY_VERIFIED/.test(read('lib/server/marketplace/operational-payout-corrections.ts')))
test('release version synchronized', /^\d+\.\d+\.\d+$/.test(pkg.version) && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 26 operational execution: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
