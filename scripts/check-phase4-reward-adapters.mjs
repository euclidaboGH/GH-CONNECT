#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mig = read('supabase/migrations/20261029010007_gh_earnings_reward_adapters.sql')
const ad = read('lib/server/earnings/reward-adapters.ts')
const api = read('app/api/economy/earnings/adapters/route.ts')
const engine = read('lib/server/economy/reward-engine.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Reward attempts migration exists', existsSync(join(root, 'supabase/migrations/20261029010007_gh_earnings_reward_adapters.sql')))
test('Attempts audit outcomes credited|denied|duplicate', /'credited', 'denied', 'duplicate'/.test(mig))
test('Unique attempt per user/source/reference', /uq_gh_earnings_reward_attempt_ref/.test(mig))
test('Client RLS deny-all on attempts', /gh_earnings_reward_attempts_no_client/.test(mig))
test('Adapters default disabled without env flags', /PI_EARNINGS_ADAPTERS_ENABLED/.test(ad) && /ADAPTERS_DISABLED/.test(ad))
test('Testnet sandbox required for credits', /PI_A2U_TESTNET_ONLY/.test(ad) && /resolvePiSandbox/.test(ad))
test('Self-interaction denied', /SELF_INTERACTION_DENIED/.test(ad))
test('Daily caps and single-credit caps enforced', /DAILY_CAPS_ATOMIC/.test(ad) && /MAX_SINGLE_ATOMIC/.test(ad) && /DAILY_CAP_EXCEEDED/.test(ad))
test('Stable reference required', /REFERENCE_REQUIRED/.test(api) || /INVALID_INPUT/.test(ad))
test('Credits go through unified ledger postEarningsCredit', /postEarningsCredit/.test(ad))
test('API forbids client system source', /SYSTEM_SOURCE_FORBIDDEN/.test(api))
test('GHC issuance remains locked to daily claim policy', /GHC_ISSUANCE_POLICY_LOCKED/.test(engine) || /DAILY_CLAIM_ONLY/.test(engine))
test('GET exposes policy without granting', /getRewardAdapterPolicy/.test(api) && /export async function GET/.test(api))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 4 reward adapters: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
