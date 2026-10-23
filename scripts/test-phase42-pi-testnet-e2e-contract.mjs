#!/usr/bin/env node
/**
 * Phase 42 source contract: Pi Testnet E2E must use real server authorities.
 * This is a static safety gate; it never fabricates Pi identity, payments, balances, or cookies.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const required = [
  'app/api/auth/pi/route.ts',
  'app/api/auth/session/route.ts',
  'app/api/payments/intents/route.ts',
  'app/api/payments/approve/route.ts',
  'app/api/payments/complete/route.ts',
  'app/api/payments/fulfill/route.ts',
  'app/api/membership/status/route.ts',
  'app/api/membership/reconcile/route.ts',
  'app/api/marketplace/orders/route.ts',
  'app/api/marketplace/orders/[orderId]/pay/route.ts',
  'app/api/marketplace/orders/[orderId]/commerce/route.ts',
  'app/api/economy/wallet/summary/route.ts',
  'app/api/economy/rewards/daily/route.ts',
  'app/api/economy/rewards/claim/route.ts',
  'app/api/messaging/conversations/route.ts',
  'app/api/notifications/route.ts',
  'app/api/realtime/events/route.ts',
  'app/api/media/direct-upload-intent/route.ts',
  'app/api/media/direct-upload-complete/route.ts',
  'app/api/social/posts/route.ts',
  'app/api/social/feed/route.ts',
  'app/api/social/posts/[id]/curation/route.ts',
  'app/api/social/creator/route.ts',
]
let pass = 0
let fail = 0
const check = (ok, label) => {
  if (ok) { pass++; console.log(`PASS ${label}`) }
  else { fail++; console.error(`FAIL ${label}`) }
}
for (const file of required) check(fs.existsSync(path.join(root, file)), `required route ${file}`)

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const authPi = read('app/api/auth/pi/route.ts')
check(authPi.includes('verifyPiAccessToken'), 'Pi auth verifies access token server-side')
check(authPi.includes('findOrCreateFromVerifiedPi'), 'Pi auth persists verified identity')
check(authPi.includes('createSession'), 'Pi auth issues GreenHaven server session')
check(authPi.includes('isPiIdentityDurable') && authPi.includes('isSessionStoreDurable'), 'Pi auth fails closed when durable stores unavailable')

const complete = read('app/api/payments/complete/route.ts')
check(complete.includes('loadPaymentIntent') && complete.includes('resolveAuthenticatedUser'), 'payment completion binds to authenticated durable intent')
check(complete.includes('piGetPayment'), 'payment completion re-verifies provider payment')
check(complete.includes('amountsMatch'), 'payment completion verifies provider amount')
check(complete.includes('tryGrantMembershipFromCompletedIntent'), 'membership entitlement is reconciled from completed payment')

const daily = read('app/api/economy/rewards/daily/route.ts')
check(daily.includes('ghc_execute_daily_claim_v12'), 'Daily Claim uses canonical DB issuance RPC')
check(!/const\s+(amount|balance|rewardAmount)\s*=\s*body\./.test(daily), 'Daily Claim does not derive authority from client economic amount')

const fulfill = read('app/api/payments/fulfill/route.ts')
check(fulfill.includes('resolveAuthenticatedUser'), 'fulfillment authenticates owner')
check(fulfill.includes('transitionIntent') || fulfill.includes('FULFILLED'), 'fulfillment uses durable payment transition')

const commerce = read('app/api/marketplace/orders/[orderId]/commerce/route.ts')
check(commerce.includes('updateCommerceOrder'), 'marketplace commerce uses canonical server transition')
check(commerce.includes('buyerId') || commerce.includes('sellerId'), 'marketplace commerce enforces buyer/seller ownership')

const curation = read('app/api/social/posts/[id]/curation/route.ts')
check(curation.includes('gh_post_curation_set_with_reward') || curation.includes('setCuration'), 'curation uses canonical atomic server path')
check(curation.includes('There is no\n  // vote-only fallback'), 'curation route documents absence of vote-only fallback')

const spec = read('e2e/phase42-pi-testnet.spec.ts')
check(spec.includes('GHC_E2E_PI_TESTNET') && spec.includes('GHC_E2E_COOKIE_A'), 'Pi E2E spec is explicitly gated and credential-driven')
check(spec.includes('GHC_E2E_ALLOW_TESTNET'), 'Pi Testnet run requires explicit opt-in')
check(!spec.includes('localStorage.setItem') && !spec.includes('fakePi'), 'Pi E2E spec does not fabricate identity')

const evidence = JSON.parse(read('docs/evidence/phase42-pi-testnet-evidence.template.json'))
check(evidence && typeof evidence === 'object', 'release evidence remains machine-readable')

console.log(`\nPhase 42 contract: ${pass} passed / ${fail} failed`)
process.exit(fail ? 1 : 0)
