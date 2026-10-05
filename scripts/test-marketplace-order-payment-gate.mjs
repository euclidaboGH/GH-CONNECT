#!/usr/bin/env node
/**
 * Static checks: Marketplace order transition payment gate.
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
let pass = 0
let fail = 0
function ok(c, m) {
  if (c) {
    pass++
    console.log('  ✓', m)
  } else {
    fail++
    console.log('  ✗', m)
  }
}

const route = fs.readFileSync(
  path.join(root, 'app/api/marketplace/orders/[orderId]/transition/route.ts'),
  'utf8'
)
const pay = fs.readFileSync(
  path.join(root, 'app/api/marketplace/orders/[orderId]/pay/route.ts'),
  'utf8'
)
const store = fs.readFileSync(
  path.join(root, 'lib/server/marketplace/order-store.ts'),
  'utf8'
)

ok(route.includes('PAYMENT_TRANSITION_FORBIDDEN'), 'rejects public payment_verified transition')
ok(route.includes('PAYMENT_REQUIRED'), 'requires verified payment for paid states')
ok(route.includes('paymentStatus === "verified"'), 'checks persisted paymentStatus')
ok(route.includes('void body.paymentStatus'), 'ignores client paymentStatus')
ok(route.includes('PAID_ORDER_CANCEL_REQUIRES_REFUND'), 'blocks paid cancel without refund')
ok(route.includes('REQUIRES_VERIFIED_PAYMENT'), 'paid-state set defined')
ok(pay.includes('transitionOrder(order.id, "payment_verified"'), 'pay route still sets payment_verified')
ok(pay.includes('market_order_'), 'pay uses market_order_ reference')
ok(store.includes('payment_pending'), 'store state machine intact')

// Ensure transition route does not blindly allow unpaid → payment_verified
ok(
  !/if \(to === "payment_verified"\) \{\s*status =/.test(route) &&
    route.includes('PAYMENT_TRANSITION_FORBIDDEN'),
  'no silent payment_verified via public API'
)

console.log(`\nMarketplace order payment-gate: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
console.log('ALL MARKETPLACE ORDER PAYMENT-GATE STATIC CHECKS PASSED')
