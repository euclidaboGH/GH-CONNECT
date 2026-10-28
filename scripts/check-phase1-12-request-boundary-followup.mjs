#!/usr/bin/env node
/** Source-level contract for bounded parsing on additional social, moderation and payout writes. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const routes = [
  ['app/api/connections/request/route.ts', '8 * 1024', 'connection request'],
  ['app/api/reports/route.ts', '8 * 1024', 'user/community report intake'],
  ['app/api/matching/signal/route.ts', '4 * 1024', 'matching signal'],
  ['app/api/social/tips/route.ts', '8 * 1024', 'creator tip intent'],
  ['app/api/marketplace/payouts/bank-beneficiaries/route.ts', '8 * 1024', 'bank beneficiary creation'],
]
const checks = [
  ['package, lockfile and app release versions agree', lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ...routes.map(([file, limit, label]) => {
    const source = read(file)
    const normalized = source.replace(/\s+/g, '')
    return [`${label} uses bounded streaming JSON (${limit} bytes)`, source.includes('readBoundedJson') && normalized.includes(`readBoundedJson(request,${limit.replace(/\s+/g, '')})`) || source.includes('readBoundedJson') && normalized.includes(`readBoundedJson(req,${limit.replace(/\s+/g, '')})`)]
  }),
  ['connection requests validate body before intent validation or database writes', read('app/api/connections/request/route.ts').indexOf('readBoundedJson(req, 8 * 1024)') < read('app/api/connections/request/route.ts').indexOf('validateConnectionIntents(body.intents || [])')],
  ['report intake rejects non-string identifiers and reasons', /typeof body\.targetId === "string"/.test(read('app/api/reports/route.ts')) && /typeof body\.reason === "string"/.test(read('app/api/reports/route.ts'))],
  ['matching signal rejects non-string target and signal values', /typeof body\.targetUserId !== "string"/.test(read('app/api/matching/signal/route.ts')) && /typeof body\.signal !== "string"/.test(read('app/api/matching/signal/route.ts'))],
  ['tip amount rejects boolean/object coercion and exponent notation', /amountSyntaxValid/.test(read('app/api/social/tips/route.ts')) && /Number\.NaN/.test(read('app/api/social/tips/route.ts')) && /\\d\+/.test(read('app/api/social/tips/route.ts'))],
  ['bank beneficiary creation requires explicit string fields', /typeof body\.accountNumber !== "string"/.test(read('app/api/marketplace/payouts/bank-beneficiaries/route.ts'))],
  ['bank beneficiary disable parses a bounded string ID', /readBoundedJson\(request, 4 \* 1024\)/.test(read('app/api/marketplace/payouts/bank-beneficiaries/route.ts')) && /typeof body\.beneficiaryId === "string"/.test(read('app/api/marketplace/payouts/bank-beneficiaries/route.ts'))],
  ['new follow-up contract is registered in the consolidated static runner', read('scripts/verify-phase14-static.mjs').includes('check-phase1-12-request-boundary-followup.mjs')],
  ['worklog documents source-only verification and runtime limitation', /source-level|source[- ]only|isolated helper test/i.test(read(`docs/UPGRADE-WORKLOG-${pkg.version}.md`)) && /Node\.js 24\.15\.0/.test(read(`docs/UPGRADE-WORKLOG-${pkg.version}.md`))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 1–12 request-boundary follow-up: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
