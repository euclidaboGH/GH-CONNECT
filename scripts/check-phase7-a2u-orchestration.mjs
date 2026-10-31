#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mig = read('supabase/migrations/20261029010009_pi_a2u_shared_orchestration.sql')
const orch = read('lib/server/payments/a2u-orchestration.ts')
const api = read('app/api/payments/a2u/orchestration/route.ts')
const claim = read('app/api/economy/rewards/pi-cashback/claim/route.ts')
const seller = read('app/api/payments/a2u/create/route.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Phase 7 migration exists', existsSync(join(root, 'supabase/migrations/20261029010009_pi_a2u_shared_orchestration.sql')))
test('Review queue table with open uniqueness', /gh_pi_a2u_review_queue/.test(mig) && /uq_gh_pi_a2u_review_open_request/.test(mig))
test('Stuck job listing for cashback and seller', /gh_pi_a2u_list_stuck_jobs/.test(mig) && /cashback/.test(mig) && /seller/.test(mig))
test('Shared provider binding requires Testnet A2U completed path', /providerPaymentMatchesA2u/.test(orch) && /Pi Testnet/.test(orch) && /canMarkA2uPaid/.test(orch))
test('Paid requires developer completed and verified txid', /PROVIDER_NOT_COMPLETED/.test(orch) && /TXID_REQUIRED/.test(orch))
test('Matching incomplete recovery helper exists', /findMatchingIncompleteA2u/.test(orch))
test('Cashback claim enqueues review on unrelated incomplete', /enqueueA2uReview/.test(claim) && /UNRELATED_INCOMPLETE_A2U_PAYMENT/.test(claim))
test('Seller A2U create enqueues review on unrelated incomplete', /enqueueA2uReview/.test(seller) && /seller_marketplace/.test(seller))
test('Operator orchestration API requires key', /x-ghc-operator-key/.test(api) && /FORBIDDEN/.test(api))
test('Client RLS deny-all on review queue', /gh_pi_a2u_review_queue_no_client/.test(mig))
test('Service-role grants on orchestration RPCs', (mig.match(/GRANT EXECUTE ON FUNCTION public\.gh_pi_a2u_/g) || []).length >= 4)

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 7 A2U orchestration: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
