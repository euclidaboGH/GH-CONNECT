#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mig = read('supabase/migrations/20261029010010_gh_earnings_available_balance_phase6.sql')
const store = read('lib/server/earnings/unified-ledger.ts')
const api = read('app/api/economy/earnings/withdrawable/route.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Phase 6 migration exists', existsSync(join(root, 'supabase/migrations/20261029010010_gh_earnings_available_balance_phase6.sql')))
test('Payout policy table with min/max/fee atomic', /gh_earnings_payout_policy/.test(mig) && /min_payout_atomic/.test(mig) && /max_single_payout_atomic/.test(mig))
test('Withdrawable RPC derives from ledger only', /gh_earnings_withdrawable/.test(mig) && /authority.*gh_earnings_ledger_entries/.test(mig))
test('Reserve uses advisory lock for concurrency', /pg_advisory_xact_lock/.test(mig) && /gh_earnings:/.test(mig))
test('Reserve rejects non-integer atomic amounts', /AMOUNT_MUST_BE_INTEGER_ATOMIC/.test(mig))
test('Reserve enforces min and max policy', /BELOW_MIN_PAYOUT/.test(mig) && /ABOVE_MAX_SINGLE_PAYOUT/.test(mig))
test('Insufficient available returns availableAtomic', /INSUFFICIENT_AVAILABLE_EARNINGS/.test(mig) && /requestedAtomic/.test(mig))
test('Release reserve compensating entry exists', /gh_earnings_release_reserve/.test(mig) && /release_reserve/.test(mig))
test('Default min payout is 0.1 PI (1e6 atomic)', /DEFAULT 1000000/.test(mig))
test('Server getWithdrawableBalance and floorPiToAtomic', /getWithdrawableBalance/.test(store) && /floorPiToAtomic/.test(store))
test('Authenticated withdrawable GET API (no client write)', /resolveAuthenticatedUser/.test(api) && /getWithdrawableBalance/.test(api) && !/request\.json\(\)/.test(api))
test('Service-role grants on phase 6 RPCs', /GRANT EXECUTE ON FUNCTION public\.gh_earnings_withdrawable/.test(mig) && /GRANT EXECUTE ON FUNCTION public\.gh_earnings_release_reserve/.test(mig))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 6 available balances: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
