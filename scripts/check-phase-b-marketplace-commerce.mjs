#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const life = read('lib/marketplace/order-lifecycle.ts')
const screen = read('components/ghc/marketplace-screen.tsx')
const commerce = existsSync(join(root, 'app/api/marketplace/orders'))
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Order lifecycle helper exists', existsSync(join(root, 'lib/marketplace/order-lifecycle.ts')))
test('Lifecycle steps cover pay→fulfill→deliver→complete', /paid/.test(life) && /fulfill/.test(life) && /delivered/.test(life) && /done/.test(life))
test('Browse sort newest/price', /price_asc/.test(life) && /sortMarketplaceListings/.test(life))
test('Marketplace screen uses lifecycle stepper', /ORDER_LIFECYCLE_STEPS/.test(screen) && /orderLifecycleIndex/.test(screen))
test('Orders role filter Buying/Selling', /orderRoleFilter/.test(screen) && /Buying/.test(screen) && /Selling/.test(screen))
test('Browse sort select wired', /gh-market-sort/.test(screen) && /browseSort/.test(screen))
test('Order message opens conversation', /openOrderConversation/.test(screen))
test('Seller fulfill and buyer confirm actions remain', /seller_fulfill/.test(screen) && /buyer_confirm/.test(screen) && /seller_mark_delivered/.test(screen))
test('Durable marketplace orders API tree present', commerce)

const failed = checks.filter((x) => !x).length
console.log(`\nPhase B marketplace commerce: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
