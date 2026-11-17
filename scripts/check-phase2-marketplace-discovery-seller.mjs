#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const screen = read('components/ghc/marketplace-screen.tsx')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }
const mods = ['search-ranking','boost-disclosure','seller-insights','returns','address-validation','recently-viewed']
for (const m of mods) test(`lib/marketplace/${m}.ts exists`, existsSync(join(root, `lib/marketplace/${m}.ts`)))
test('Phase 2 unit tests exist', existsSync(join(root, 'scripts/test-phase2-marketplace-discovery-seller.mjs')))
const pure = mods.filter((m) => m !== 'recently-viewed').map((m) => read(`lib/marketplace/${m}.ts`)).join('\n')
test('Phase 2 helpers are pure (no network, database or storage access)', !/fetch\(|supabase|\.rpc\(|localStorage|sessionStorage|document\./.test(pure))
test('Recently viewed stores ids only, scoped per account, fails closed', /ID_RE/.test(read('lib/marketplace/recently-viewed.ts')) && /PREFIX \+ id/.test(read('lib/marketplace/recently-viewed.ts')) && /catch/.test(read('lib/marketplace/recently-viewed.ts')))
test('Promoted placement is disclosed on cards', /promotionLabel\(listing\)/.test(screen) && /data-testid="promoted-label"/.test(screen))
test('Promoted share is capped and never applied to price sorts', /limitPromotedShare\(relevant\)/.test(screen) && /browseSort === "price_asc" \|\| browseSort === "price_desc" \? relevant/.test(screen))
test('Best-match sort ranks only the fetched page', /browseSort === "relevance" \? rankByRelevance\(ordered, query\)/.test(screen) && /value="relevance">Best match/.test(screen))
test('Relevance sort keeps price domains separate', /sort === "relevance"\) return \[\.\.\.items\]/.test(read('lib/marketplace/order-lifecycle.ts')))
test('Seller Centre insights wired from recorded orders and listings', /data-testid="seller-insights"/.test(screen) && /completedRevenueByCurrency\(sellerOrders\)/.test(screen))
test('Buyer return guide is guidance only (no new transition call)', /data-testid="return-guide"/.test(screen) && !/returnGuideFor[^\n]*runOrderAction/.test(screen))
test('More-from-seller reads the existing listing domain', /data-testid="more-from-seller"/.test(screen) && /getMarketplaceDomain\(\)\?\.listListings/.test(screen))
test('Recently viewed strip is wired and hidden during search/category browsing', /data-testid="recently-viewed"/.test(screen) && /!query\.trim\(\) && !category && recentIds\.length > 0/.test(screen))
test('Seller checklist is wired into the create-listing form, display only and non-blocking', /from "@\/lib\/marketplace\/seller-checklist"/.test(screen) && /data-testid="seller-checklist"/.test(screen) && /sellerChecklist\(\{/.test(screen) && !/checklistProgress\([^)]*\)\.requiredMet[^\n]*(setSellError|return)/.test(screen))
test('Address validation does not persist data', !/setItem|localStorage|fetch\(/.test(read('lib/marketplace/address-validation.ts')))
test('Payment, order transition and payout code untouched', !/runOrderAction\(o\.id, "return"/.test(screen) && /socialPayMarketplaceOrder\(orderId, "ghc"\)/.test(screen))
test('No new migration added for Phase 2', !/phase2_marketplace/i.test(read('MIGRATION-SOURCE-MANIFEST.csv')))
const failed = checks.filter((x) => !x).length
console.log(`\nPhase 2 marketplace discovery & seller: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
