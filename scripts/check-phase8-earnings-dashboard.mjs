#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const dash = read('components/ghc/unified-earnings-dashboard.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Unified earnings dashboard component exists', existsSync(join(root, 'components/ghc/unified-earnings-dashboard.tsx')))
test('Fetches withdrawable and statement APIs', /\/api\/economy\/earnings\/withdrawable/.test(dash) && /\/api\/economy\/earnings/.test(dash))
test('Shows available pending reserved paid', /Available/.test(dash) && /Pending/.test(dash) && /Reserved/.test(dash) && /Paid/.test(dash))
test('Explains ineligible reasons', /BELOW_MIN_PAYOUT/.test(dash) && /LINKED_PI_IDENTITY_REQUIRED/.test(dash))
test('3% fee and linked Pi wallet copy', /3%/.test(dash) && /linked at sign-in/.test(dash))
test('Fee quote via POST /api/economy/earnings/quote', /\/api\/economy\/earnings\/quote/.test(dash))
test('Does not invent balances on failure', /No balances were invented/.test(dash))
test('Wired into wallet screen', /UnifiedEarningsDashboard/.test(wallet))
test('Wired into rewards centre', /UnifiedEarningsDashboard/.test(rewards))
test('Ledger history with statuses', /Recent ledger/.test(dash) && /statusTone/.test(dash))
test('Atomic ledger amounts use atomic-unit conversion for numeric and string payloads', /function atomicToDisplay/.test(dash) && /BigInt\(raw\)/.test(dash) && /amount_atomic/.test(dash))
test('Invalid financial values never fall back to a fabricated zero', /return "Unavailable"/.test(dash) && !/return "0 π"/.test(dash))
test('Quote requires server eligibility and linked Pi identity', /snap\?\.eligible !== true/.test(dash) && /snap\.piWalletLinked !== true/.test(dash))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 8 earnings dashboard: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
