#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mig = read('supabase/migrations/20261029010011_gh_earnings_withdrawal_fee_3pct.sql')
const store = read('lib/server/earnings/unified-ledger.ts')
const api = read('app/api/economy/earnings/quote/route.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Fee migration exists', existsSync(join(root, 'supabase/migrations/20261029010011_gh_earnings_withdrawal_fee_3pct.sql')))
test('fee_bps defaults to 300 (3%)', /fee_bps integer NOT NULL DEFAULT 300/.test(mig) && /fee_bps = 300/.test(mig))
test('Quote RPC computes fee and net', /gh_earnings_quote_withdrawal/.test(mig) && /netAtomic/.test(mig) && /feeAtomic/.test(mig))
test('Recipient from gh_pi_identities only', /gh_pi_identities/.test(mig) && /recipientPiAppUid/.test(mig) && /LINKED_PI_IDENTITY_REQUIRED/.test(mig))
test('Wallet authorization required when table present', /WALLET_AUTHORIZATION_REQUIRED/.test(mig))
test('Quote API never accepts client recipient', !/body\.recipient/.test(api) && !/body\.piAppUid/.test(api) && /recipientSource: "gh_pi_identities"/.test(api))
test('Server quoteWithdrawal + preview helper', /quoteWithdrawal/.test(store) && /previewWithdrawalFeeAtomic/.test(store))
test('Ceil fee bps math present', /gross \* feeBps \+ 9999/.test(store) || /v_gross \* v_policy.fee_bps \+ 9999/.test(mig))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 6 withdrawal fee 3%: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
