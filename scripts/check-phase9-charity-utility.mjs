#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const mig = read('supabase/migrations/20261029010012_gh_charity_utility_accounting.sql')
const mod = read('lib/server/earnings/platform-utility.ts')
const charityApi = read('app/api/economy/earnings/charity/route.ts')
const platApi = read('app/api/economy/earnings/platform/route.ts')
const dash = read('components/ghc/unified-earnings-dashboard.tsx')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Phase 9 migration exists', existsSync(join(root, 'supabase/migrations/20261029010012_gh_charity_utility_accounting.sql')))
test('Platform utility kinds include withdrawal_fee and charity', /withdrawal_fee/.test(mig) && /charity_in/.test(mig))
test('Charity contributions unique per user ref', /uq_gh_charity_user_ref/.test(mig))
test('Client RLS deny-all on both tables', /gh_platform_utility_no_client/.test(mig) && /gh_charity_contributions_no_client/.test(mig))
test('Charity never credits available balance (documented)', /never credits available balance/.test(mig) || /segregated from user withdrawable/.test(mig))
test('postWithdrawalFee and recordCharityContribution helpers', /postWithdrawalFee/.test(mod) && /recordCharityContribution/.test(mod))
test('Charity API authenticated GET/POST', /export async function GET/.test(charityApi) && /export async function POST/.test(charityApi))
test('Platform summary requires operator key', /x-ghc-operator-key/.test(platApi) && /FORBIDDEN/.test(platApi))
test('Dashboard shows segregated charity', /charity/.test(dash) && /separate from withdrawable/.test(dash))
test('Service-role grants on phase 9 RPCs', (mig.match(/GRANT EXECUTE ON FUNCTION public\.gh_/g) || []).length >= 4)

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 9 charity/utility: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
