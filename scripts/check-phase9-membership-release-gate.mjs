#!/usr/bin/env node
/** Phase 9 source release gate. Never contacts or mutates external systems. */
import { readFileSync } from 'node:fs'
const read = (file) => readFileSync(file, 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const manifest = read('MIGRATION-SOURCE-MANIFEST.csv')
const truth = read('docs/PROJECT_TRUTH.md')
const roadmap = read('docs/PRODUCT-ROADMAP.md')
const worklog = read('docs/UPGRADE-WORKLOG-0.327.0.md')
const phase = read('docs/PHASE-9-MEMBERSHIP-LIFECYCLE-AND-ACCESS-CONTROL-0.326.0.md')
const strictPiPhase = read('docs/PHASE-9-MEMBERSHIP-PI-INTENT-SECURITY-0.327.0.md')
const renewalMigration = '20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql'
const strictPiMigration = '20261106143001_phase9_membership_pi_renewal_strict_provider_guard.sql'
const checks = [
  ['package and lockfile are 0.329.0 and synchronized', pkg.version === '0.329.0' && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version],
  ['Node 24.15.0 remains the supported build runtime', pkg.engines?.node === '^24.15.0' && read('.nvmrc').trim() === '24.15.0'],
  ['Phase 9 contracts are registered in prebuild', pkg.scripts.prebuild.includes('check-phase9-membership-release-gate.mjs') && pkg.scripts.prebuild.includes('check-phase9-membership-experience.mjs') && pkg.scripts.prebuild.includes('check-phase9-pi-intent-security.mjs') && pkg.scripts.prebuild.includes('test-phase9-pi-intent-contract.mjs')],
  ['Phase 9 contracts are registered in static verification', pkg.scripts['verify:static'].includes('check-phase9-membership-release-gate.mjs') && pkg.scripts['verify:static'].includes('check-phase9-membership-experience.mjs') && pkg.scripts['verify:static'].includes('check-phase9-pi-intent-security.mjs') && pkg.scripts['verify:static'].includes('test-phase9-pi-intent-contract.mjs')],
  ['New lifecycle/renewal migration is classified REVIEW_REQUIRED', manifest.split('\n').some((line) => line.startsWith(`${renewalMigration},REVIEW_REQUIRED,`))],
  ['Strict Pi renewal follow-up is classified REVIEW_REQUIRED', manifest.split('\n').some((line) => line.startsWith(`${strictPiMigration},REVIEW_REQUIRED,`))],
  ['Completed membership grant paths require exact Pi intent discriminators', strictPiPhase.includes('provider === \"pi\"') && strictPiPhase.includes('currency === \"PI\"') && strictPiPhase.includes('purpose === \"membership\"')],
  ['Migration inventory states source files do not prove remote application', /does NOT prove migrations are applied/i.test(read('VERIFIED_MANIFEST.txt'))],
  ['Membership lifecycle API binds history to authenticated identity', read('app/api/membership/lifecycle/route.ts').includes('resolveAuthenticatedUser') && read('app/api/membership/lifecycle/route.ts').includes('auth.userId')],
  ['Expiry sweep and renewal operator routes require operator authentication', read('app/api/operator/operational/membership-expire/route.ts').includes('assertOperatorKey') && read('app/api/operator/operational/membership-renew/route.ts').includes('assertOperatorKey')],
  ['Membership authorization is server-side and precedes protected spend', read('app/api/messaging/premium/route.ts').includes('checkMembershipTierAccess') && read('app/api/messaging/premium/route.ts').indexOf('const access = await checkMembershipTierAccess') < read('app/api/messaging/premium/route.ts').indexOf('const spend = await executeDurableGhcSpend')],
  ['Prepaid plans do not silently enable auto-renew or recurring billing', /do not auto-renew|no automatic renewal|non-recurring/i.test(phase) && /no[- ]auto[- ]renew/i.test(worklog)],
  ['GHC and Pi remain separate payment rails', /GHC and Pi remain separate rails and ledgers/i.test(worklog) && /GHC and Pi pricing\/settlement authorities remain separate/i.test(truth)],
  ['72-hour grace is continuity-only and does not grant access', /not\*\* preserve premium access/i.test(phase) && /no grace access/i.test(phase)],
  ['Production acceptance remains explicitly pending', /not production approval/i.test(phase) && /production approval remains pending/i.test(truth)],
  ['Phase 9 source is complete with acceptance open; Phase 10 is active', roadmap.includes('| 9 | Membership | Source implementation complete') && roadmap.includes('| 10 | Settings and platform performance | Active: 0.329.0')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`Phase 9 membership release gate: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
