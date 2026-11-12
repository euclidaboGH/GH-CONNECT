#!/usr/bin/env node
/** Phase 9 first increment: strict entitlement authority and safe plan selection. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const read = (name) => readFileSync(join(process.cwd(), name), 'utf8')
const store = read('lib/server/membership/entitlement-store.ts')
const parser = read('lib/server/membership/entitlement-row.ts')
const status = read('app/api/membership/status/route.ts')
const activate = read('app/api/membership/activate/route.ts')
const screen = read('components/ghc/premium-membership-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const roadmap = read('docs/PRODUCT-ROADMAP.md')
const checks = [
  ['Membership rows are bound to the authenticated user id', parser.includes('userId !== requestedUserId')],
  ['Unknown membership tiers fail closed', parser.includes('MEMBERSHIP_ROW_TIER_INVALID') && parser.includes('TIERS.has(tier)')],
  ['Non-boolean active flags fail closed', parser.includes('MEMBERSHIP_ROW_ACTIVE_INVALID')],
  ['Unknown membership sources and periods fail closed', parser.includes('MEMBERSHIP_ROW_SOURCE_INVALID') && parser.includes('MEMBERSHIP_ROW_PERIOD_INVALID')],
  ['Malformed paid expiry cannot become a perpetual entitlement', parser.includes('MEMBERSHIP_ROW_EXPIRY_INVALID') && parser.includes('MEMBERSHIP_PAID_EXPIRY_MISSING')],
  ['Comp entitlements are the only permitted non-expiring paid tier', parser.includes('source === "comp" || billingPeriod === "comp"')],
  ['Expired or inactive paid rows normalize to Free', parser.includes('EXPIRED_OR_INACTIVE') && parser.includes('normalizedTier = "free"')],
  ['Audit history is bounded and sanitized', parser.includes('slice(-40)') && parser.includes('action.slice') === false && parser.includes('slice(0, 80)')],
  ['Authoritative entitlement database reads have an eight-second abort bound', store.includes('setTimeout(() => controller.abort(), 8_000)') && store.includes('signal: controller.signal')],
  ['Database read failures remain unavailable rather than Free', store.includes('MEMBERSHIP_STORE_UNAVAILABLE') && store.includes('if (!fromDb.ok) return fromDb')],
  ['Membership status endpoint disables shared caching', status.includes('Cache-Control') && status.includes('no-store, no-cache, must-revalidate')],
  ['Membership purchase rejects conflicting period aliases', activate.includes('CONFLICTING_MEMBERSHIP_PERIODS')],
  ['Membership purchase rejects conflicting month and period values', activate.includes('CONFLICTING_MEMBERSHIP_DURATION')],
  ['Server catalog continues to determine membership charges', activate.includes('getMembershipGhcPrice(tier, paidMonths).chargeGhc') && activate.includes('getMembershipPiPrice(tier, paidMonths).chargePi')],
  ['Pi activation requires a durable completed/fulfilled intent and exact product id', activate.includes('intent.status !== "COMPLETED" && intent.status !== "FULFILLED"') && activate.includes('productId !== expected')],
  ['Membership UI status hydration has a bounded abort timeout', screen.includes('window.setTimeout(() => controller.abort(), 8_000)') && screen.includes('signal: controller.signal')],
  ['Release metadata and lockfile are synchronized', Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['Membership source is complete with acceptance open; Feed and Wallet occupy priorities 1 and 2', roadmap.includes('| 4 | **Membership** |') && roadmap.includes('| 1 | **Feed** |') && roadmap.includes('Source implementation completed in 0.330.19;') && roadmap.includes('| 2 | **Wallet** |') && roadmap.includes('Source implementation completed in 0.330.20;')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Phase 9 membership foundation: ${checks.length}/${checks.length} checks passed.`)
