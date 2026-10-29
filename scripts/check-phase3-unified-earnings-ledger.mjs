#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mig = read('supabase/migrations/20261029010006_gh_unified_earnings_ledger.sql')
const store = read('lib/server/earnings/unified-ledger.ts')
const api = read('app/api/economy/earnings/route.ts')
const claim = read('app/api/economy/rewards/pi-cashback/claim/route.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Unified earnings ledger migration present', existsSync(join(root, 'supabase/migrations/20261029010006_gh_unified_earnings_ledger.sql')))
test('Entry statuses include pending/available/reserved/paid/reversed/disputed', /'pending', 'available', 'reserved', 'paid', 'reversed', 'disputed'/.test(mig))
test('Source kinds cover cashback, activity, creator, charity, adjustment, withdrawal', /cashback/.test(mig) && /activity_reward/.test(mig) && /creator_earning/.test(mig) && /charity/.test(mig))
test('Unique idempotency on user_id + unique_ref', /uq_gh_earnings_user_ref/.test(mig))
test('Positive atomic amounts only (no float storage)', /amount_atomic > 0/.test(mig) && /trunc\(p_amount_atomic\) <> p_amount_atomic/.test(mig))
test('Client RLS deny-all', /gh_earnings_ledger_no_client/.test(mig))
test('Balances derived from entries via RPC', /gh_earnings_balances/.test(mig) && /availableAtomic/.test(mig))
test('Reserve refuses when insufficient available', /INSUFFICIENT_AVAILABLE_EARNINGS/.test(mig))
test('Settle refuses without matching reservation', /INSUFFICIENT_RESERVED_FOR_PAYOUT/.test(mig))
test('Duplicate post credit is idempotent', /duplicate', true/.test(mig) || /duplicate',true/.test(mig))
test('Service-role-only grants on ledger RPCs', (mig.match(/GRANT EXECUTE ON FUNCTION public\.gh_earnings_/g) || []).length >= 5)
test('Server module uses atomic scale 1e7', /PI_ATOMIC_SCALE = 10_000_000/.test(store) || /10000000/.test(store))
test('Authenticated earnings statement API exists', /resolveAuthenticatedUser/.test(api) && /getEarningsStatement/.test(api))
test('Cashback claim posts credit, reserves, and settles on success', /postEarningsCredit/.test(claim) && /reserveEarningsForPayout/.test(claim) && /settleEarningsPayout/.test(claim))
test('API never accepts client-supplied balances to write', !/request\.json\(\)/.test(api))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 3 unified earnings ledger: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
