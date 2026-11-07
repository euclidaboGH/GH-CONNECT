#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = (file) => readFileSync(file, 'utf8')
const screen = read('components/ghc/premium-membership-screen.tsx')
const access = read('lib/server/membership/membership-access.ts')
const messaging = read('app/api/messaging/premium/route.ts')
const renewal = read('lib/server/membership/renewal-workflow.ts')
const renewalRoute = read('app/api/operator/operational/membership-renew/route.ts')
const migration = read('supabase/migrations/20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql')
const lifecycleRoute = read('app/api/membership/lifecycle/route.ts')
const expiryRoute = read('app/api/operator/operational/membership-expire/route.ts')
const roadmap = read('docs/PRODUCT-ROADMAP.md')
const release = read('lib/app-release.ts')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const checks = [
  ['Premium membership status presentation is server-authoritative, not local-cache colored', screen.includes('serverStatusState === "ready" && authoritativeStatus?.active') && !screen.includes('status?.active')],
  ['Membership activity is loaded through an authenticated no-store endpoint', screen.includes('/api/membership/lifecycle') && screen.includes('credentials: "include"') && screen.includes('cache: "no-store"')],
  ['Lifecycle history is independently cancellable and account-scoped', screen.includes('lifecycleRequestRef.current?.abort()') && screen.includes('setMembershipLifecycle([])')],
  ['Renewal continuity copy explicitly pauses premium access during the gap', screen.includes('premium features remain paused during any gap') && screen.includes('no grace access is being granted')],
  ['Prepaid membership is explicit about no automatic renewal', screen.includes('This plan does not auto-renew')],
  ['Pi purchase success requires the exact server-confirmed tier', screen.includes('next && next.active && next.tier === tier') && screen.includes('emitMembershipActivated(next.tier, "pi")')],
  ['GHC purchase success never falls back to browser-local membership state', screen.includes('Payment was accepted, but membership activation is not yet confirmed') && !screen.includes('getBoundDomainServices()?.membership?.getStatus?.()')],
  ['Server entitlement helper reads canonical authoritative membership', access.includes('tryGetEntitlementAuthoritative(uid)') && access.includes('MEMBERSHIP_STORE_UNAVAILABLE')],
  ['Protected messaging products enforce required membership before GHC debit', messaging.indexOf('const access = await checkMembershipTierAccess') < messaging.indexOf('const spend = await executeDurableGhcSpend') && messaging.includes('No GHC was charged')],
  ['Renewal workflow loads the durable payment intent and binds its owner', renewal.includes('loadPaymentIntent(paymentIntentId)') && renewal.includes('intent.userId !== userId')],
  ['Renewal workflow independently checks completed PI catalog product and amount', renewal.includes('intent.status !== "COMPLETED"') && renewal.includes('intent.provider !== "pi"') && renewal.includes('getMembershipPiPrice')],
  ['Operator renewal route no longer accepts client duration or period', !renewalRoute.includes('durationInterval') && !renewalRoute.includes('billingPeriod')],
  ['Operator renewal route fails closed unless the renewal RPC returns ok=true', renewalRoute.includes('if (result.ok !== true)') && renewalRoute.includes('return reply({ ...result, ok: false }, 409)')],
  ['SQL derives paid and bonus months from verified product ID', migration.includes('v_access_months := v_paid_months + 1') && migration.includes('make_interval(months => v_access_months)')],
  ['SQL independently checks PI provider, currency, purpose and catalog amount', migration.includes("i.provider <> 'pi'") && migration.includes("upper(i.currency) <> 'PI'") && migration.includes('v_expected_amount')],
  ['SQL renewal is idempotent by durable payment-intent lifecycle event', migration.includes('WHERE payment_intent_id = i.id AND user_id = i.user_id') && migration.includes('e.payment_intent_id = i.id')],
  ['72-hour continuity grace does not grant premium access before payment verification', migration.includes("e.expires_at >= now() - interval '72 hours'") && migration.includes('Access is NOT extended during this gap')],
  ['Membership lifecycle RPC is read-only and service-role-only', migration.includes('ghc_membership_get_lifecycle') && migration.includes('GRANT EXECUTE ON FUNCTION public.ghc_membership_get_lifecycle(text, integer)')],
  ['Authenticated lifecycle API never returns financial amounts', lifecycleRoute.includes('auth.userId') && !lifecycleRoute.includes('amount:') && !lifecycleRoute.includes('row.amount') && lifecycleRoute.includes('no-store')],
  ['Expiry sweep is operator-gated and bounded', expiryRoute.includes('assertOperatorKey') && expiryRoute.includes('rawLimit > 2_000') && expiryRoute.includes('ghc_membership_expire_due')],
  ['Migration is classified for operator review, not auto-application', read('scripts/generate-migration-inventory.mjs').includes('20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql')],
  ['Release and package metadata are synchronized', Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['Phase 9 source is complete with acceptance open; Phase 10 is active', roadmap.includes('| 9 | Membership | Source implementation complete') && roadmap.includes(`| 10 | Settings and platform performance | Active: ${pkg.version}`)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Phase 9 membership experience: ${checks.length}/${checks.length} checks passed.`)
