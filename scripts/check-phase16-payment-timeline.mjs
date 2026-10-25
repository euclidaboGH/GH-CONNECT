#!/usr/bin/env node
/** Phase 16 contract checks; static only, no provider, database, or network claims. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const route = read('app/api/payments/intents/[intentId]/timeline/route.ts')
const detail = read('components/ghc/pi-payment-detail.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const manifest = read('VERIFIED_MANIFEST.txt')
const checks = [
  ['release/package/lock/manifest versions agree', pkg.version === '0.105.0' && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && manifest.includes(`project_version=${pkg.version}`)],
  ['Phase 16 report exists', fs.existsSync(path.join(process.cwd(), 'PHASE-16-PAYMENT-LIFECYCLE-OBSERVABILITY.md'))],
  ['timeline endpoint requires authenticated user', /resolveAuthenticatedUser\(request\.headers\)/.test(route) && /AUTH_REQUIRED/.test(route)],
  ['timeline endpoint enforces intent ownership before returning data', /intent\.userId !== auth\.userId/.test(route) && /FORBIDDEN/.test(route)],
  ['timeline endpoint is read-only and no-store', /readOnly: true/.test(route) && /Cache-Control.*no-store/.test(route) && !/method:\s*["'](POST|PUT|PATCH|DELETE)/.test(route)],
  ['only persisted audit events are returned', /intent\.audit/.test(route) && /persisted_payment_intent_audit/.test(route) && /No events or timestamps were synthesized/.test(route)],
  ['event metadata is not exposed', /\.map\(\(event, index\) =>/.test(route) && !/meta:\s*event\.meta/.test(route)],
  ['timeline events are ordered by persisted timestamp', /\.sort\(\(a, b\) => a\.at - b\.at\)/.test(route)],
  ['payment detail exposes explicit user-triggered history loading', /View stored payment history/.test(detail) && /loadTimeline/.test(detail) && /cache:\s*"no-store"/.test(detail)],
  ['empty or partial audit history is disclosed honestly', /will not invent missing events or timestamps/.test(detail) && /not a complete Pi provider or blockchain event feed/.test(detail)],
  ['timeline feature does not mutate payment state', !/fetch\([^\n]*method:\s*["'](POST|PUT|PATCH|DELETE)/.test(detail)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 16 payment lifecycle observability: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
