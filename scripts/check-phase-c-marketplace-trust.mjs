#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const trust = read('lib/marketplace/trust.ts')
const screen = read('components/ghc/marketplace-screen.tsx')
const domain = read('lib/domains/marketplace-domain.ts')
const reportRoute = read('app/api/marketplace/listings/[listingId]/report/route.ts')
const reportMigration = read('supabase/migrations/20261106150001_marketplace_listing_report_intake.sql')
const operatorReports = read('app/api/admin/marketplace/listing-reports/route.ts')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Trust helper module exists', existsSync(join(root, 'lib/marketplace/trust.ts')))
test('Delivery modes meetup/shipping/digital/service', /meetup/.test(trust) && /shipping/.test(trust) && /digital/.test(trust) && /service/.test(trust))
test('Listing reports use durable server intake instead of device-local queue', /gh_marketplace_listing_report_create/.test(reportRoute) && !/queueListingReport/.test(trust))
test('Seller trust band uses getSellerProfile', /getSellerProfile/.test(screen) && /formatRating/.test(screen))
test('Report listing UI confirms only durable server submission', /Report listing/.test(screen) && /result\?\.durable !== true/.test(screen) && /api\/marketplace\/listings/.test(screen))
test('Marketplace report storage is RLS-protected and service-role-only', /gh_marketplace_listing_reports/.test(reportMigration) && /ENABLE ROW LEVEL SECURITY/.test(reportMigration) && /TO service_role/.test(reportMigration))
test('Operator report queue and review transitions are protected', /timingSafeEqual/.test(operatorReports) && /checkDurableRateLimit/.test(operatorReports) && /gh_marketplace_listing_report_transition/.test(operatorReports))
test('Delivery section on listing detail', /formatDeliveryLine/.test(screen) && /Delivery/.test(screen))
test('Sell form delivery mode controls', /sellDeliveryMode/.test(screen) && /DELIVERY_MODE_LABELS/.test(screen))
test('shippingInfo encoded on publish paths', (screen.match(/encodeShippingInfo\(sellDeliveryMode/g) || []).length >= 3)
test('Reviews only after completed orders in domain', /order\.status !== "completed"/.test(domain) && /Only the buyer can review/.test(domain))
test('Leave review CTA on completed buyer orders', /Leave review/.test(screen) && /submitReview/.test(screen))
test('Saved listings surface retained', /bucket === "saved"/.test(screen) || /Nothing saved yet/.test(screen))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase C marketplace trust: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
