#!/usr/bin/env node
/** Phase 14: reconciliation query-efficiency and diagnostic contract. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const route = read('app/api/payments/reconciliation/route.ts')
const wallet = read('features/wallet/wallet-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const manifest = read('VERIFIED_MANIFEST.txt')
const checks = [
  ['release/package/lock/manifest versions agree', /^0\.\d+\.\d+$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && manifest.includes(`project_version=${pkg.version}`)],
  ['Phase 14 report exists', fs.existsSync(path.join(process.cwd(), 'docs/archive/phase-notes/PHASE-14-RECONCILIATION-EFFICIENCY.md'))],
  ['reconciliation remains authenticated and user-scoped', /resolveAuthenticatedUser\(request\.headers\)/.test(route) && /listIntentsForUserAsync\(auth\.userId\)/.test(route) && /scope: "authenticated_user"/.test(route)],
  ['membership entitlement is fetched once per request, not once per intent', /const membershipState = hasMembershipIntents\s*\? await tryGetEntitlementAuthoritative\(auth\.userId\)/.test(route) && (route.match(/tryGetEntitlementAuthoritative\(auth\.userId\)/g) || []).length === 1],
  ['reconciliation polling is rate-limited per authenticated user with Retry-After', route.includes('checkRateLimit(`payment-reconciliation:${auth.userId}`, 10, 60_000)') && route.includes('pruneRateLimitBuckets()') && route.includes('"Retry-After": String(limit.retryAfterSec)')],
  ['rate-limit response is non-cacheable and uses HTTP 429', route.includes('status: 429, headers: { ...noStore') && route.includes('error: "RATE_LIMITED"')],
  ['feature-store reconciliation fan-out is bounded to five concurrent lookups', /mapWithConcurrency\(intents, 5, async \(intent\)/.test(route) && /const workerCount = Math\.min\(concurrency, items\.length\)/.test(route)],
  ['bounded reconciliation preserves input ordering and validates concurrency', /results\[index\] = await mapper\(items\[index\], index\)/.test(route) && /INVALID_RECONCILIATION_CONCURRENCY/.test(route)],
  ['membership reconciliation uses the shared authoritative result', /const loaded = membershipState/.test(route) && /loaded\.source !== "db"/.test(route)],
  ['diagnostic response provides generation time and no-store policy', /generatedAt: new Date\(\)\.toISOString\(\)/.test(route) && /Cache-Control.*no-store/.test(route)],
  ['endpoint explicitly remains read-only', /readOnly: true/.test(route) && !/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(route)],
  ['wallet displays the server snapshot freshness without inventing a timestamp', /generatedAt: typeof reconciliationData\.generatedAt === "string"/.test(wallet) && /Number\.isFinite\(Date\.parse\(serverReconciliation\.generatedAt\)\)/.test(wallet)],
  ['wallet still treats server reconciliation as separate diagnostic data', /serverReconciliation/.test(wallet) && /diagnostic only/.test(wallet)],
  ['unknown feature mappings remain unverified instead of inferred as successful', /FEATURE_MAPPING_NOT_IMPLEMENTED/.test(route) && /reconciliation: "unverified"/.test(route)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 14 reconciliation efficiency contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
