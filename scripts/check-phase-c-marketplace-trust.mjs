#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const trust = read('lib/marketplace/trust.ts')
const screen = read('components/ghc/marketplace-screen.tsx')
const domain = read('lib/domains/marketplace-domain.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Trust helper module exists', existsSync(join(root, 'lib/marketplace/trust.ts')))
test('Delivery modes meetup/shipping/digital/service', /meetup/.test(trust) && /shipping/.test(trust) && /digital/.test(trust) && /service/.test(trust))
test('Listing report queue helper', /queueListingReport/.test(trust))
test('Seller trust band uses getSellerProfile', /getSellerProfile/.test(screen) && /formatRating/.test(screen))
test('Report listing UI on detail', /Report listing/.test(screen) && /queueListingReport/.test(screen))
test('Delivery section on listing detail', /formatDeliveryLine/.test(screen) && /Delivery/.test(screen))
test('Sell form delivery mode controls', /sellDeliveryMode/.test(screen) && /DELIVERY_MODE_LABELS/.test(screen))
test('shippingInfo encoded on publish paths', (screen.match(/encodeShippingInfo\(sellDeliveryMode/g) || []).length >= 3)
test('Reviews only after completed orders in domain', /order\.status !== "completed"/.test(domain) && /Only the buyer can review/.test(domain))
test('Leave review CTA on completed buyer orders', /Leave review/.test(screen) && /submitReview/.test(screen))
test('Saved listings surface retained', /bucket === "saved"/.test(screen) || /Nothing saved yet/.test(screen))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase C marketplace trust: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
