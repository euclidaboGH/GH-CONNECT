#!/usr/bin/env node
/** Static contract + exact-arithmetic reference tests for the cashback ledger foundation. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p) => readFileSync(join(process.cwd(), p), 'utf8')
const migrationPath = 'supabase/migrations/20261029010001_pi_cashback_attribution_and_period_ledger.sql'
const sql = read(migrationPath)
const adapter = read('lib/server/revenue/revenue-event.ts')
const marketplacePay = read('app/api/marketplace/orders/[orderId]/pay/route.ts')
const inventory = read('scripts/generate-migration-inventory.mjs')
const packageJson = JSON.parse(read('package.json'))
const checks = []
const test = (name, condition) => { checks.push([name, Boolean(condition)]); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`) }

// Reference model for PostgreSQL FLOOR(max(0, net_atomic) * 3 / 100).
const cashback = (netAtomic) => (netAtomic > 0n ? netAtomic : 0n) * 3n / 100n

test('migration adds canonical payer attribution without replacing old journal API', /ADD COLUMN IF NOT EXISTS paying_user_id text/.test(sql) && /gh_company_revenue_event_append_attributed/.test(sql) && /gh_company_revenue_event_append\(/.test(read('supabase/migrations/20261022010091_company_revenue_event_journal.sql')))
test('cashback eligibility is opt-in and defaults false', /cashback_eligible boolean NOT NULL DEFAULT false/.test(sql) && /p_cashback_eligible boolean DEFAULT false/.test(sql))
test('negative fees or taxes cannot inflate ordinary revenue attribution', /INVALID_REVENUE_COSTS/.test(sql) && /INVALID_REVENUE_COSTS/.test(adapter))
test('cashback requires PI provider, PI currency and a canonical paying user', /v_provider <> 'pi' OR v_currency <> 'PI' OR v_user_id IS NULL/.test(sql))
test('revenue events stay append-only and duplicate conflicts compare attribution', /v_existing\.paying_user_id IS NOT DISTINCT FROM v_user_id/.test(sql) && /v_existing\.cashback_eligible = COALESCE\(p_cashback_eligible, false\)/.test(sql) && /related_source_event_id/.test(sql) && /gh_company_revenue_event_append_attributed/.test(sql))
test('cashback tables have RLS and no direct client/service-role table grants', /ALTER TABLE public\.gh_pi_cashback_periods ENABLE ROW LEVEL SECURITY/.test(sql) && /ALTER TABLE public\.gh_pi_cashback_entitlements ENABLE ROW LEVEL SECURITY/.test(sql) && /REVOKE ALL ON TABLE public\.gh_pi_cashback_entitlements FROM PUBLIC, anon, authenticated, service_role/.test(sql))
test('only service_role can call privileged attribution and period-close RPCs', /GRANT EXECUTE ON FUNCTION public\.gh_company_revenue_event_append_attributed[\s\S]*?TO service_role/.test(sql) && /GRANT EXECUTE ON FUNCTION public\.gh_pi_cashback_period_close[\s\S]*?TO service_role/.test(sql) && /FROM PUBLIC, anon, authenticated/.test(sql))
test('four-month windows enforce UTC Jan/May/Sep starts, exact duration and end-of-period close', /AT TIME ZONE 'UTC'/.test(sql) && /extract\(month FROM \(p_starts_at AT TIME ZONE 'UTC'\)\) NOT IN \(1, 5, 9\)/.test(sql) && /p_ends_at AT TIME ZONE 'UTC'/.test(sql) && /interval '4 months'/.test(sql) && /PERIOD_NOT_ENDED/.test(sql))
test('eligible refunds/chargebacks must reference the original payer-owned source event', /CASHBACK_COMPENSATION_SOURCE_REQUIRED/.test(sql) && /CASHBACK_COMPENSATION_SOURCE_MISMATCH/.test(sql) && /p_related_source_event_id/.test(adapter))
test('calculation selects only verified, attributed, eligible PI revenue in the window', /source_provider = 'pi' AND currency = 'PI' AND cashback_eligible = true/.test(sql) && /paying_user_id IS NOT NULL AND verified_at >= p_starts_at AND verified_at < p_ends_at/.test(sql))
test('cashback is floored at 3% and negative net revenue yields zero', /FLOOR\(GREATEST\(0::numeric, net_atomic\) \* 3 \/ 100\)/.test(sql) && cashback(-100n) === 0n && cashback(99n) === 2n)
test('PI uses integer atomic units and does not use floating point in SQL', /1 unit = 0\.0000001 PI/.test(sql) && !/double precision|real\b|float\b/i.test(sql))
test('user/period/policy entitlement is unique and period-close retries are idempotent', /UNIQUE \(user_id, period_id, policy_version\)/.test(sql) && /UNIQUE \(starts_at, ends_at\)/.test(sql) && /PERIOD_ID_OR_POLICY_CONFLICT/.test(sql) && /IF v_existing_id IS NOT NULL/.test(sql) && /'duplicate', true/.test(sql))
test('calculated entitlements are immutable and explicitly not withdrawable blockchain payouts', /status text NOT NULL DEFAULT 'calculated' CHECK \(status IN \('calculated', 'needs_review'\)\)/.test(sql) && /GH_PI_CASHBACK_ENTITLEMENT_APPEND_ONLY/.test(sql) && /not yet withdrawable/i.test(sql) && /does NOT initiate or authorize A2U payments/i.test(sql))
test('TypeScript adapter routes attributed events to the attributed RPC', /gh_company_revenue_event_append_attributed/.test(adapter) && /p_paying_user_id/.test(adapter) && /p_cashback_eligible/.test(adapter))
test('TypeScript adapter rejects cashback without verified PI attribution', /CASHBACK_ATTRIBUTION_REQUIRED/.test(adapter) && /input\.sourceProvider !== "pi"/.test(adapter))
test('marketplace PI commission is attributed to the authenticated buyer and stable completed intent time', /payingUserId: order\.buyerId/.test(marketplacePay) && /cashbackEligible: true/.test(marketplacePay) && /intent\.completedAt/.test(marketplacePay) && /priorIntent\.completedAt/.test(marketplacePay))
test('verified marketplace PI order retries revenue journaling without submitting another payment', /Re-run the idempotent journal append before returning NOT_PAYABLE/.test(marketplacePay) && /PAYMENT_VERIFIED_RECONCILIATION_REQUIRED/.test(marketplacePay))
test('new migration is classified REVIEW_REQUIRED with disposable DB/Testnet gate', /20261029010001_pi_cashback_attribution_and_period_ledger\.sql/.test(inventory) && /Financially critical cashback foundation/.test(inventory))
test('package registers the ledger contract check in prebuild and static verification', packageJson.scripts?.prebuild?.includes('check-pi-cashback-ledger.mjs') && read('scripts/verify-phase14-static.mjs').includes('check-pi-cashback-ledger.mjs'))
test('cashback calculation example: 20 PI net revenue produces 0.6 PI cashback', cashback(200_000_000n) === 6_000_000n)
test('cashback calculation floors fractional atomic unit results', cashback(33n) === 0n && cashback(34n) === 1n)
test('cashback payout implementation is separately gated and not conflated with the ledger foundation', /20261029010004_pi_cashback_testnet_a2u_payouts\.sql/i.test(read('docs/PI-A2U-EARNINGS-AND-CASHBACK-ROADMAP.md')) && /PI_A2U_TESTNET_ONLY !== "true"/.test(read('app/api/economy/rewards/pi-cashback/claim/route.ts')) && /withdrawalEnabled/.test(read('app/api/economy/rewards/pi-cashback/route.ts')))

const failed = checks.filter(([, ok]) => !ok).length
console.log(`\nPi cashback ledger contract: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
