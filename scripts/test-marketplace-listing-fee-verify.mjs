#!/usr/bin/env node
/**
 * Static checks for marketplace listing-fee verification wiring.
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
let pass = 0
let fail = 0

function ok(cond, msg) {
  if (cond) {
    pass++
    console.log('  ✓', msg)
  } else {
    fail++
    console.log('  ✗', msg)
  }
}

const route = fs.readFileSync(path.join(root, 'app/api/marketplace/listings/route.ts'), 'utf8')
const helper = fs.readFileSync(
  path.join(root, 'lib/server/marketplace/verify-listing-fee-payment.ts'),
  'utf8'
)

ok(route.includes('verifyListingFeePayment'), 'listings route imports/uses verifyListingFeePayment')
ok(route.includes('void body.feePaid'), 'client feePaid ignored')
ok(route.includes('LISTING_FEE_PAYMENT'), 'fee payment errors returned')
ok(!/if \(!feePaymentRef\) \{\s*status = "draft"/.test(route), 'no presence-only draft fallback for active+fee')
ok(helper.includes('LISTING_FEE_PAYMENT_OWNERSHIP'), 'ownership check')
ok(helper.includes('LISTING_FEE_PAYMENT_AMOUNT'), 'amount check')
ok(helper.includes('LISTING_FEE_PAYMENT_NOT_COMPLETE'), 'completion check')
ok(helper.includes('LISTING_FEE_PAYMENT_NOT_BOUND'), 'listing binding required')
ok(helper.includes('marketplace_listing_fee_'), 'expected reference convention')
ok(helper.includes('COMPLETED') && helper.includes('FULFILLED'), 'accepts completed/fulfilled only')
ok(helper.includes('listingFeeRequiresSettlement'), 'respects zero-fee path')

console.log(`\nMarketplace listing-fee verify: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
console.log('ALL LISTING-FEE VERIFY STATIC CHECKS PASSED')
