#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const screen = read('components/ghc/marketplace-screen.tsx')
const review = read('lib/marketplace/review-quality.ts')
const landed = read('lib/marketplace/landed-cost.ts')
const badges = read('lib/marketplace/listing-badges.ts')
const checklist = read('lib/marketplace/seller-checklist.ts')
const skeleton = read('components/ghc/marketplace-skeleton.tsx')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

for (const f of ['lib/marketplace/review-quality.ts','lib/marketplace/landed-cost.ts','lib/marketplace/listing-badges.ts','lib/marketplace/seller-checklist.ts','components/ghc/marketplace-skeleton.tsx','scripts/test-phase1-marketplace-trust-speed.mjs'])
  test(`${f} exists`, existsSync(join(root, f)))
test('Verified ratings require an order id', /isVerifiedReview/.test(review) && /orderId/.test(review))
test('Review module is display-only (no network/storage/mutation)', !/fetch\(|localStorage|sessionStorage|\.push\(.*review|supabase|rpc\(/.test(review))
test('Landed cost never sums mixed currencies', /mixedCurrency/.test(landed) && /total: null, mixedCurrency: true/.test(landed))
test('Landed cost is display-only and defers to the server quote', /server quote remains the payment authority/.test(landed) && !/fetch\(|supabase/.test(landed))
test('Badges are derived only from recorded facts', /sellerTrustBadges/.test(badges) && !/Math\.random|fetch\(/.test(badges))
test('Seller checklist is pure', !/fetch\(|localStorage|useState/.test(checklist))
test('Skeleton honours reduced motion and is announced', /motion-reduce:animate-none/.test(skeleton) && /role="status"/.test(skeleton))
test('Screen imports Phase 1 modules', /review-quality/.test(screen) && /listing-badges/.test(screen) && /landed-cost/.test(screen) && /marketplace-skeleton/.test(screen))
test('Screen shows only featured verified reviews', /featuredReviews\(sellerReviews, 3\)/.test(screen) && /verified purchase/.test(screen))
test('Browse shows skeleton only while loading with no listings', /serverBrowseState === "loading" && listings\.length === 0 \? <ListingGridSkeleton/.test(screen))
test('Checkout shows item and delivery lines without changing payment calls', /landed-cost-summary/.test(screen) && /socialPayMarketplaceOrder\(orderId, "ghc"\)/.test(screen))
test('Existing report intake and review gating preserved', /gh_marketplace_listing_report_create/.test(read('app/api/marketplace/listings/[listingId]/report/route.ts')) && /order\.status !== "completed"/.test(read('lib/domains/marketplace-domain.ts')))
test('No new migration added for Phase 1', !/phase1_marketplace_trust/i.test(read('MIGRATION-SOURCE-MANIFEST.csv')))
const failed = checks.filter((x) => !x).length
console.log(`\nPhase 1 marketplace trust & speed: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
