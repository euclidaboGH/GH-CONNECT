#!/usr/bin/env node
/** Phase 15 payment recovery UX contract; no network or database required. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const detail = read('components/ghc/pi-payment-detail.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const manifest = read('VERIFIED_MANIFEST.txt')
const checks = [
  ['release/package/lock/manifest versions agree', Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && manifest.includes(`project_version=${pkg.version}`)],
  ['Phase 15 report exists', fs.existsSync(path.join(process.cwd(), 'docs/archive/phase-notes/PHASE-15-PAYMENT-RECOVERY.md'))],
  ['Pi history offers a manual read-only refresh', /aria-label="Refresh Pi payment history"/.test(wallet) && /onClick=\{\(\) => setTick\(\(n\) => n \+ 1\)\}/.test(wallet) && /Refresh checks the latest stored records; it does not retry or charge a payment/.test(wallet)],
  ['support summary uses persisted intent and diagnostic identifiers', /Payment intent ID: \$\{intent\.id\}/.test(detail) && /Diagnostic code: \$\{finding\?\.code/.test(detail) && /Reference ID: \$\{intent\.referenceId/.test(detail)],
  ['support summary is generated locally as a user-triggered download', /downloadSupportSummary/.test(detail) && /URL\.createObjectURL/.test(detail) && /greenhaven-payment-support-/.test(detail) && !/fetch\([^\n]*method:\s*["'](POST|PUT|PATCH|DELETE)/.test(detail)],
  ['recovery guidance warns against duplicate payment on ambiguity', /Avoid submitting a second payment while the first result is uncertain/.test(detail) && /Do not pay again just because an item or entitlement is missing/.test(detail)],
  ['paid state is not equated with feature fulfilment', /payment is recorded as paid, but feature fulfilment is not necessarily complete/.test(detail)],
  ['Pi and GHC payment rails remain separate', /separate from GHC ledger transfers/.test(wallet)],
  ['release retains the existing reconciliation endpoint and read-only contract', /readOnly: true/.test(read('app/api/payments/reconciliation/route.ts')) && /resolveAuthenticatedUser\(request\.headers\)/.test(read('app/api/payments/reconciliation/route.ts'))],
  ['no automatic payment mutation was introduced in Pi detail UI', !/fetch\([^\n]*method:\s*["'](POST|PUT|PATCH|DELETE)/.test(detail)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 15 payment recovery contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
