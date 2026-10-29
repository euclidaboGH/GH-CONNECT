#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const routePath = 'app/api/economy/rewards/pi-cashback/claim/route.ts'
const migrationPath = 'supabase/migrations/20261029010004_pi_cashback_testnet_a2u_payouts.sql'
const route = read(routePath)
const migration = read(migrationPath)
const ui = read('components/ghc/pi-cashback-summary.tsx')
const api = read('app/api/economy/rewards/pi-cashback/route.ts')
const pkg = JSON.parse(read('package.json'))
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
test('Dedicated authenticated user cashback A2U endpoint exists', existsSync(join(root, routePath)) && /resolveAuthenticatedUser\(request\.headers\)/.test(route))
test('A2U payout is hard-gated to explicit Pi Testnet configuration', /PI_A2U_ENABLED !== "true"/.test(route) && /PI_A2U_TESTNET_ONLY !== "true"/.test(route) && /!resolvePiSandbox\(\)/.test(route) && /PI_ENV !== "production"/.test(route) && /network: "Pi Testnet"/.test(route))
test('Amount and recipient are derived server-side, not trusted from request body', /gh_pi_identities/.test(route) && /gh_pi_cashback_a2u_begin/.test(route) && !/request\.json\(\)/.test(route))
test('Separate payout ledger has unique entitlement and provider transaction bindings', /entitlement_id uuid NOT NULL UNIQUE/.test(migration) && /provider_payment_id text UNIQUE/.test(migration) && /txid text UNIQUE/.test(migration))
test('Cashback A2U shares the global Pi wallet sequence lease', /gh_pi_a2u_sequence_lease/.test(migration) && /gh_pi_a2u_release_sequence_lease/.test(route))
test('Paid state requires completed execution, provider payment and txid', /status <> 'paid' OR \(execution_state = 'completed' AND provider_payment_id IS NOT NULL AND txid IS NOT NULL AND paid_at IS NOT NULL\)/.test(migration) && /gh_pi_cashback_a2u_settle/.test(route))
test('Provider recipient, amount, network, metadata, verified txid and developer completion are checked', /providerMatches\(payment/.test(route) && /transaction_verified === true/.test(route) && /developer_completed !== true/.test(route))
test('Provider timeout/interruption remains retryable without inventing a paid result', /PI_CASHBACK_PAYOUT_INTERRUPTED/.test(route) && /retryable: true/.test(route) && /payoutSettled: false/.test(route))
test('No direct client access to cashback payout table or privileged RPCs', /ENABLE ROW LEVEL SECURITY/.test(migration) && /REVOKE ALL ON TABLE public\.gh_pi_cashback_a2u_payouts FROM PUBLIC, anon, authenticated, service_role/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_pi_cashback_a2u_begin.*TO service_role/s.test(migration))
test('Rewards UI exposes claim only when server flags and positive finalized balance allow it', /payload\?\.withdrawalEnabled/.test(ui) && /Withdraw finalized cashback to Pi wallet/.test(ui) && /withdrawalEnabled/.test(api))
test('Payout status reduces available calculated amount and appears in statement rows', /reservedAtomic/.test(api) && /payoutsByEntitlement/.test(api) && /payout_processing/.test(api))
test('Build and static verification include this A2U contract', pkg.scripts?.prebuild?.includes('check-pi-cashback-a2u.mjs') && read('scripts/verify-phase14-static.mjs').includes('check-pi-cashback-a2u.mjs'))

// Phase 1 recovery regressions — unrelated incomplete must not leave processing stuck
test('Unrelated incomplete A2U durably moves payout to attention before client error', /UNRELATED_INCOMPLETE_A2U_PAYMENT_REQUIRES_REVIEW/.test(route) && /update\("attention"[\s\S]{0,120}UNRELATED_INCOMPLETE_A2U_PAYMENT/.test(route) && /getIncompleteServerPayments\(\)/.test(route))
test('Matching incomplete payment for this requestId is resumed instead of blocked', (/matching\?\.identifier/.test(route) || /matched\?\.identifier/.test(route) || /findMatchingIncompleteA2u/.test(route)) && /payoutRequestId/.test(route) && /createPayment/.test(route))
test('SQL update maps attention execution state to attention payout status', /status=CASE WHEN p_state='attention' THEN 'attention' ELSE status END/.test(migration))
test('Begin refuses new claim while user has attention payout requiring review', /status='attention'/.test(migration) && /CASHBACK_PAYOUT_REQUIRES_OPERATOR_REVIEW/.test(migration))
test('Update rejects transitions once already in attention', /CASHBACK_PAYOUT_REQUIRES_OPERATOR_REVIEW/.test(migration) && /execution_state='attention'/.test(migration))

const failed = checks.filter((x) => !x).length
console.log(`\nPi cashback Testnet A2U contract: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
