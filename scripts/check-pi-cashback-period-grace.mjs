#!/usr/bin/env node
/** Static safety contract for late-arriving revenue and immutable four-month cashback closes. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const read = (p) => readFileSync(join(process.cwd(), p), 'utf8')
const migration = read('supabase/migrations/20261029010003_pi_cashback_period_reconciliation_grace.sql')
const ledger = read('supabase/migrations/20261029010001_pi_cashback_attribution_and_period_ledger.sql')
const inventory = read('scripts/generate-migration-inventory.mjs')
const packageJson = JSON.parse(read('package.json'))
const suite = read('scripts/verify-phase14-static.mjs')
const checks = [
  ['period keeps original four-month window while close is delayed', /now\(\) < p_ends_at \+ interval '7 days'/.test(migration) && /window remains \[starts_at, ends_at\)/.test(migration) && /interval '4 months'/.test(ledger)],
  ['late verified revenue has a reconciliation window before immutable snapshot', /PERIOD_RECONCILIATION_WINDOW_OPEN/.test(migration) && /reconciliationAvailableAt/.test(migration)],
  ['wrapper delegates to original validated close after grace', /gh_pi_cashback_period_close_unchecked\([\s\S]*?p_period_id, p_starts_at, p_ends_at, p_policy_version/.test(migration)],
  ['renamed underlying close cannot be called by API roles', /REVOKE ALL ON FUNCTION public\.gh_pi_cashback_period_close_unchecked[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/.test(migration)],
  ['new close remains service-role only', /REVOKE ALL ON FUNCTION public\.gh_pi_cashback_period_close\(text,timestamptz,timestamptz,text\)[\s\S]*?FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_pi_cashback_period_close\(text,timestamptz,timestamptz,text\)[\s\S]*?TO service_role/.test(migration)],
  ['period close still creates entitlement records, not blockchain payouts', /does NOT initiate or authorize A2U payments/i.test(ledger) && /not a payout/i.test(migration)],
  ['migration is classified for explicit review and never auto-applied', /20261029010003_pi_cashback_period_reconciliation_grace\.sql/.test(inventory) && /REVIEW_REQUIRED/.test(inventory)],
  ['contract runs in prebuild and full static verification', packageJson.scripts.prebuild.includes('check-pi-cashback-period-grace.mjs') && suite.includes('check-pi-cashback-period-grace.mjs')],
]
let failed = 0
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failed++ }
console.log(`\nPi cashback period grace contract: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
