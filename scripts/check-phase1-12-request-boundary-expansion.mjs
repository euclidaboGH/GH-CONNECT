#!/usr/bin/env node
/** Source-only request boundary regression checks for high-impact financial, identity and social writes. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const routes = [
  ['app/api/marketplace/payouts/route.ts', '8 * 1024', 'seller payout request'],
  ['app/api/marketplace/payouts/bank-requests/route.ts', '8 * 1024', 'bank payout request'],
  ['app/api/membership/activate/route.ts', '8 * 1024', 'membership activation'],
  ['app/api/economy/packs/intent/route.ts', '4 * 1024', 'GHC pack payment intent'],
  ['app/api/auth/step-up/route.ts', '8 * 1024', 'step-up authentication token intake'],
  ['app/api/ads/verify/route.ts', '4 * 1024', 'rewarded-ad verification signal'],
  ['app/api/social/blocks/route.ts', '4096', 'social block mutation'],
  ['app/api/social/restricts/route.ts', '4096', 'social restrict mutation'],
  ['app/api/social/mutes/route.ts', '4096', 'social mute mutation'],
  ['app/api/social/follows/route.ts', '4096', 'social follow mutation'],
  ['app/api/social/saves/route.ts', '4096', 'social save mutation'],
  ['app/api/payments/intents/[intentId]/recover/route.ts', '4 * 1024', 'payment recovery input'],
]
const checks = [
  ['package, lockfile and app release metadata agree', lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ...routes.map(([file, limit, label]) => {
    const source = read(file)
    const normalized = source.replace(/\s+/g, '')
    const parserCall = `readBoundedJson(request,${limit.replace(/\s+/g, '')})`
    return [`${label} uses streaming body limit (${limit} bytes)`, source.includes('readBoundedJson') && normalized.includes(parserCall) && /REQUEST_TOO_LARGE/.test(source) && /parsedBody\.error|boundedBody\.error/.test(source)]
  }),
  ['payout amount rejects booleans and malformed coercible values', /typeof amountInput === "number"/.test(read('app/api/marketplace/payouts/route.ts')) && /Number\.NaN/.test(read('app/api/marketplace/payouts/route.ts'))],
  ['social follow target identifier requires a string', /typeof body\.targetUserId === "string"/.test(read('app/api/social/follows/route.ts'))],
  ['step-up token body is bounded before token verification', read('app/api/auth/step-up/route.ts').indexOf('readBoundedJson(request, 8 * 1024)') < read('app/api/auth/step-up/route.ts').indexOf('verifyPiAccessToken(accessToken)')],
  ['payment recovery body is bounded before provider lookup', read('app/api/payments/intents/[intentId]/recover/route.ts').indexOf('readBoundedJson(request, 4 * 1024)') < read('app/api/payments/intents/[intentId]/recover/route.ts').indexOf('piGetPayment(paymentId)')],
  ['new request-boundary suite is registered in static verification', read('scripts/verify-phase14-static.mjs').includes('check-phase1-12-request-boundary-expansion.mjs')],
  ['release worklog records source-only verification limits', /source-level|source[- ]only/i.test(read('docs/UPGRADE-WORKLOG-0.157.14.md')) && /Node\.js 24\.15\.0/.test(read('docs/UPGRADE-WORKLOG-0.157.14.md'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 1–12 request-boundary expansion: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
