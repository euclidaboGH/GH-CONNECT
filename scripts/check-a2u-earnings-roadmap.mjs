#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const roadmapPath = 'docs/PI-A2U-EARNINGS-AND-CASHBACK-ROADMAP.md'
const roadmap = read(roadmapPath)
const a2uCreate = read('app/api/payments/a2u/create/route.ts')
const revenueMigration = read('supabase/migrations/20261022010091_company_revenue_event_journal.sql')
const cashbackMigration = read('supabase/migrations/20261029010001_pi_cashback_attribution_and_period_ledger.sql')
const payoutMigration = read('supabase/migrations/20261022010113_pi_a2u_sdk_execution_orchestration.sql')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const manifest = read('VERIFIED_MANIFEST.txt')
const checks = []
const test = (name, condition) => { checks.push([name, Boolean(condition)]); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`) }
test('roadmap exists and identifies Mainnet approval as outstanding', existsSync(join(root, roadmapPath)) && /Mainnet approval remain outstanding/i.test(roadmap))
test('Rewards Center earns and Wallet manages payouts without a new top-level section', /Rewards Center = earn and understand/i.test(roadmap) && /Wallet = manage and receive/i.test(roadmap) && /Do not create a new top-level section/i.test(roadmap))
test('cashback rate is 3% of attributable eligible net company revenue', /net eligible company revenue attributable to an individual user's eligible Pi spending/i.test(roadmap) && /× 0\.03/.test(roadmap))
test('four-month periods and UTC boundaries are specified', /fixed UTC accounting windows/i.test(roadmap) && /Jan 1–Apr 30, May 1–Aug 31, Sep 1–Dec 31 UTC/i.test(roadmap))
test('PI arithmetic avoids floating point and rounds to seven decimal places', /integer atomic units at 10\^-7 PI/i.test(roadmap) && /floor_to_1e-7_pi/i.test(roadmap))
test('roadmap records the original attribution gap and v0.157.23 foundation', /v0\.157\.23 now wires the marketplace PI commission producer/i.test(roadmap) && /ADD COLUMN IF NOT EXISTS paying_user_id text/.test(cashbackMigration) && /cashback_eligible boolean NOT NULL DEFAULT false/.test(cashbackMigration) && !/paying_user_id\s+(uuid|text)/i.test(revenueMigration))
test('cashback A2U uses a separate payout domain from seller payouts', /gh_seller_payout_requests/i.test(payoutMigration) && /gh_pi_cashback_a2u_payouts/i.test(roadmap) && /distinct .* entitlement-linked cashback payout ledger/i.test(roadmap))
test('A2U route remains Testnet-gated', /PI_A2U_TESTNET_ONLY !== "true"/.test(a2uCreate) && /!resolvePiSandbox\(\)/.test(a2uCreate) && /Testnet only/i.test(a2uCreate))
test('roadmap requires idempotency, refunds, funding and reconciliation controls', /idempotency constraint/i.test(roadmap) && /Refunds, chargebacks/i.test(roadmap) && /Reconciliation of every entitlement/i.test(roadmap))
test('roadmap documents Mainnet A2U permission gate and official references', /confirm GreenHaven's A2U eligibility and outgoing-wallet approval with Pi/i.test(roadmap) && /developers\.minepi\.com/.test(roadmap))
test('roadmap regression check runs before production builds', pkg.scripts?.prebuild?.includes('node scripts/check-a2u-earnings-roadmap.mjs'))
test('roadmap check is registered in network-independent static verification', read('scripts/verify-phase14-static.mjs').includes('check-a2u-earnings-roadmap.mjs'))
test('package and lockfile versions agree', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version)
test('release and verified manifest versions match package', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && manifest.includes(`project_version=${pkg.version}`))
const failed = checks.filter(([, ok]) => !ok).length
console.log(`\nA2U earnings/cashback roadmap contract: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
