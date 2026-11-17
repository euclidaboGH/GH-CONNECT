#!/usr/bin/env node
/** Priority 4 Membership product transformation source contract. No external calls. */
import { readFileSync } from 'node:fs'
const read = (file) => readFileSync(file, 'utf8')
const screen = read('components/ghc/premium-membership-screen.tsx')
const domain = read('lib/domains/membership-domain.ts')
const pricing = read('lib/membership-pricing.ts')
const activate = read('app/api/membership/activate/route.ts')
const entitlementStore = read('lib/server/membership/entitlement-store.ts')
const downgradeMigration = read('supabase/migrations/20261107160001_membership_active_tier_downgrade_guard.sql')
const paymentIntentRoute = read('app/api/payments/intents/route.ts')
const checks = [
  ['Plan comparison is derived from the canonical membership plan catalog', screen.includes('function buildMembershipCompareRows') && screen.includes('MEMBERSHIP_PLANS[tier].entitlements.includes(key)')],
  ['Comparison pricing follows the selected duration from the shared GHC catalog', screen.includes('getMembershipGhcPrice(tier, period)') && screen.includes('getMembershipPiPrice(tier, period)')],
  ['Comparison includes the selected term and bonus month', screen.includes('paid month${period === 1 ? "" : "s"} + 1 bonus month')],
  ['Plan limits and multipliers come from the membership domain', screen.includes('MEMBERSHIP_PLANS[currentTier].mediaMaxPhotos') && screen.includes('MEMBERSHIP_PLANS[currentTier].dailyBoosts') && domain.includes('ghcDailyEarnMultiplier')],
  ['Misleading claim that paid tiers have no boosts/priority has been removed', !screen.includes('No paid boosts or priority placement')],
  ['Active-plan action no longer advertises a broken immediate renewal', screen.includes('Explore VVIP') && screen.includes('Compare benefits') && !screen.includes('"Renew"')],
  ['Current-plan navigation points to a meaningful next action', screen.includes('membership-plan-vvip') && screen.includes('membership-compare-title')],
  ['Purchase review distinguishes GHC and Pi catalog prices', screen.includes('GHC price') && screen.includes('Pi price') && screen.includes('not a conversion of GHC')],
  ['Pi and GHC purchase buttons display their exact selected-term amounts', screen.includes('Pay with π · {getMembershipPiPrice(confirmTier, period).chargePi.toLocaleString()} π') && screen.includes('Pay with GHC · {getMembershipGhcPrice(confirmTier, period).chargeGhc.toLocaleString()} GHC')],
  ['Purchase review accurately describes a one-time prepaid term', screen.includes('one-time prepaid purchase') && !screen.includes('subscription · one bonus month')],
  ['Every Free member is not prompted to recover a nonexistent purchase', screen.includes('{recoverHint ? (') && !screen.includes('recoverHint || (membershipAuthorityReady && currentTier === "free")')],
  ['Membership activity has an accessible expand/collapse path', screen.includes('showAllMembershipActivity ? 20 : 5') && screen.includes('aria-expanded={showAllMembershipActivity}')],
  ['Account changes clear the expanded activity view', screen.includes('setShowAllMembershipActivity(false)')],
  ['Current-plan benefit summary is generated from canonical entitlement data', screen.includes('MEMBERSHIP_PLANS[currentTier].entitlements.slice(0, 8)')],
  ['Membership management exposes the server-confirmed membership start date', screen.includes('authoritativeStatus?.startedAt') && screen.includes('Member since')],
  ['Plan comparison table has an accessible descriptive caption', screen.includes('Comparison of Free, VIP and VVIP membership benefits and selected-term prices')],
  ['Complimentary paid access is not mislabeled as standard Free access', screen.includes('Complimentary membership · no scheduled expiry')],
  ['Manual refresh reports the actual result rather than stale React state', screen.includes('refreshed ? "Status refreshed" : "Membership status unavailable"')],
  ['Prepaid non-recurring renewal policy remains unchanged server-side', activate.includes('alreadyActive') && activate.includes('MEMBERSHIP_STORE_UNAVAILABLE') && pricing.includes('bonusMonths: 1')],
  ['Purchase and entitlement grants remain server-authoritative', activate.includes('resolveAuthenticatedUser') && activate.includes('tryGrantMembershipFromCompletedIntent') && activate.includes('ghc_purchase_membership')],
  ['Comparison categories can be filtered accessibly', screen.includes('compareCategories') && screen.includes('aria-pressed={compareCategory === category}') && screen.includes('visibleCompareRows')],
  ['Paid downgrade is blocked in the plan chooser', screen.includes('TIER_RANK[tier] > TIER_RANK[currentTier]') && screen.includes('MEMBERSHIP_DOWNGRADE_NOT_ALLOWED') === false],
  ['Activation route rejects VVIP-to-VIP purchases before payment', activate.includes('existingIsActive') && activate.includes('MEMBERSHIP_DOWNGRADE_NOT_ALLOWED')],
  ['Pi completion grant path independently rejects paid downgrade', entitlementStore.includes('currentActive && current.entitlement.tier === "vvip" && tier === "vip"')],
  ['Pi intent creation blocks downgrade before opening provider payment', paymentIntentRoute.includes('CANONICAL_MEMBERSHIP_PRODUCT_REQUIRED') && paymentIntentRoute.includes('MEMBERSHIP_DOWNGRADE_NOT_ALLOWED') && paymentIntentRoute.includes('No Pi payment was started')],
  ['Membership payment source is not falsely labelled Pi when external', screen.includes('External payment') && screen.includes('source === "pi"')],
  ['Current plan shows server-derived remaining term and non-recurring status', screen.includes('days remaining · no automatic renewal')],
  ['Purchase review discloses list price, savings and selected bonus term', screen.includes('listPriceGhc') && screen.includes('discountGhc') && screen.includes('listPricePi') && screen.includes('discountPi') && screen.includes('prepaid term')],
  ['Purchase CTAs remain disabled until server status is authoritative', screen.includes('disabled={!canPurchaseTier(tier) || isOffline}')],
  ['Database migration protects active VVIP from direct-RPC downgrade', downgradeMigration.includes('BEFORE UPDATE OF tier, active, expires_at') && downgradeMigration.includes('MEMBERSHIP_DOWNGRADE_NOT_ALLOWED')],
  ['Membership downgrade migration is explicitly review-gated and unapplied', downgradeMigration.includes('REVIEW_REQUIRED') && downgradeMigration.includes('Do not apply until Testnet/Mainnet migration histories are reconciled')],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`Priority 4 Membership transformation: ${checks.length - failed}/${checks.length} passed.`)
if (failed) process.exit(1)
