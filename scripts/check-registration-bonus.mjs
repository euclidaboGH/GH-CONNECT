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

test('registration bonus module exists', existsSync(join(root, 'lib/server/earnings/registration-bonus.ts')))
test('amount is 0.05 PI (500000 atomic scale note)', /REGISTRATION_BONUS_PI = 0\.05/.test(mod) && /REGISTRATION_BONUS_ATOMIC/.test(mod))
test('unique_ref is registration_bonus:v1:user', /registration_bonus:\$\{REGISTRATION_BONUS_POLICY_VERSION\}/.test(mod) || /registration_bonus:v1:/.test(mod))
test('credits via postEarningsCredit available/system', /postEarningsCredit/.test(mod) && /status: "available"/.test(mod) && /sourceKind: REGISTRATION_BONUS_SOURCE_KIND/.test(mod))
test('never trusts client amount', /Body ignored|server-derived/.test(route))
test('GET and POST routes exist', /export async function GET/.test(route) && /export async function POST/.test(route))
test('claim UI on rewards', /RegistrationBonusCard/.test(read('components/ghc/rewards-centre-screen.tsx')))
test('claim UI on wallet feature', /RegistrationBonusCard/.test(read('features/wallet/wallet-screen.tsx')))
test('flag documented in env example', /GHC_REGISTRATION_BONUS_ENABLED/.test(env))
test('disable path exists', /isRegistrationBonusEnabled/.test(mod))

const failed = checks.filter((x) => !x).length
console.log(`\nRegistration bonus: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
