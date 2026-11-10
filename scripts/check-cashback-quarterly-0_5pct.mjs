#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mig = read('supabase/migrations/20261029010013_pi_cashback_quarterly_0_5pct.sql')
const attr = read('lib/server/revenue/cashback-attribution.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Migration 013 exists', existsSync(join(root, 'supabase/migrations/20261029010013_pi_cashback_quarterly_0_5pct.sql')))
test('Rate is 50 bps (0.5%)', /v_rate_bps integer := 50/.test(mig) && /CASHBACK_RATE_BPS = 50/.test(attr))
test('Quarterly UTC windows (Jan/Apr/Jul/Oct + 3 months)', /NOT IN \(1, 4, 7, 10\)/.test(mig) && /interval '3 months'/.test(mig))
test('Period error is quarterly', /PERIOD_MUST_BE_FIXED_QUARTERLY_UTC_WINDOW/.test(mig))
test('Uses eligible user spend (gross_amount_minor)', /gross_amount_minor/.test(mig) && /spend_atomic/.test(mig))
test('Cadence quarterly in policy helpers', /cadence: "quarterly"/.test(attr) || /quarterly/.test(attr))
test('7-day grace retained', /interval '7 days'/.test(mig))

const failed = checks.filter((x) => !x).length
console.log(`\nCashback quarterly 0.5%: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
