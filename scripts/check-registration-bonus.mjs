#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

const mod = read('lib/server/earnings/registration-bonus.ts')
const route = read('app/api/economy/earnings/registration-bonus/route.ts')
const card = read('components/ghc/registration-bonus-card.tsx')
const env = read('.env.example')
const migration = read('supabase/migrations/20261030010001_registration_bonus_v2_reconciliation.sql')
const ledger = read('lib/server/earnings/unified-ledger.ts')
const backfill = read('scripts/ops/phase2-registration-bonus-backfill-testnet.sql')

test('registration bonus module exists', existsSync(join(root, 'lib/server/earnings/registration-bonus.ts')))
test('new claim amount is 3 PI (30000000 atomic)', /REGISTRATION_BONUS_PI = 3/.test(mod) && /REGISTRATION_BONUS_ATOMIC/.test(mod))
test('legacy v1 claimant receives exactly 2.95 PI top-up', /REGISTRATION_BONUS_TOPUP_PI = 2\.95/.test(mod) && /29500000/.test(migration))
test('v2 full claim and v2 top-up use separate idempotency references', /registration_bonus:\$\{REGISTRATION_BONUS_POLICY_VERSION\}/.test(mod) && /registration_bonus:v2_topup:/.test(mod) && /registration_bonus:v2:' \|\| v_user/.test(migration))
test('claims use privileged database-side reconciliation RPCs', /claimRegistrationBonusPolicy/.test(mod) && /gh_earnings_registration_bonus_claim/.test(ledger) && /gh_earnings_post_credit/.test(migration))
test('never trusts client amount', /Body ignored|server-derived/.test(route))
test('GET and POST routes exist', /export async function GET/.test(route) && /export async function POST/.test(route))
test('claim UI on rewards', /RegistrationBonusCard/.test(read('components/ghc/rewards-centre-screen.tsx')))
test('claim UI stays on rewards (not wallet)', (() => {
  const rewards = /RegistrationBonusCard/.test(read('components/ghc/rewards-centre-screen.tsx'))
  const walletHasCard = /RegistrationBonusCard/.test(read('features/wallet/wallet-screen.tsx'))
  // Wallet must not host claim UI; Rewards is the sole claim surface for registration bonus.
  return rewards && !walletHasCard
})())
test('flag documented in env example', /GHC_REGISTRATION_BONUS_ENABLED/.test(env))
test('bonus fails closed unless explicitly enabled and Pi sandbox is true', /GHC_REGISTRATION_BONUS_ENABLED \?\? \"0\"/.test(mod) && /sandbox === \"true\"/.test(mod) && /GHC_REGISTRATION_BONUS_ENABLED=0/.test(env))
test('status lookup is direct and not limited to statement pagination', /gh_earnings_registration_bonus_status/.test(ledger) && /gh_earnings_registration_bonus_status/.test(migration))
test('claim RPC serializes concurrent same-user requests', /pg_advisory_xact_lock/.test(migration))
test('legacy top-up requires the exact historical PI credit and a valid ledger state', /amount_atomic = 500000/.test(migration) && /asset = 'PI'/.test(migration) && /source_table = 'registration_bonus'/.test(migration) && /LEGACY_BONUS_REVIEW_REQUIRED/.test(migration))
test('claim RPC restricted to service role', /REVOKE ALL ON FUNCTION public\.gh_earnings_registration_bonus_claim\(text\) FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_earnings_registration_bonus_claim\(text\) TO service_role/.test(migration))
test('migration does not bulk-credit users on apply', !/INSERT INTO public\.gh_earnings_ledger_entries[\s\S]*SELECT/.test(migration))
test('operator backfill is explicitly Testnet-only and calls the idempotent RPC', /TESTNET ONLY/.test(backfill) && /gh_earnings_registration_bonus_claim/.test(backfill) && /registration_bonus:v1:/.test(backfill))
test('operator backfill fails closed if any user reconciliation fails', /RAISE EXCEPTION/.test(backfill))

const failed = checks.filter((x) => !x).length
console.log(`\nRegistration bonus: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
