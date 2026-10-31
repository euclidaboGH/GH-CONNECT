#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const core = read('lib/client/section-refresh.ts')
const hook = read('hooks/use-section-refresh.ts')
const market = read('components/ghc/marketplace-screen.tsx')
const communities = read('components/ghc/communities-screen.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const notifications = read('components/ghc/notification-bell.tsx')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('section-refresh coordinator exists', existsSync(join(root, 'lib/client/section-refresh.ts')))
test('attachSoftRefresh + emitSectionRefresh + async gate', /attachSoftRefresh/.test(core) && /emitSectionRefresh/.test(core) && /createAsyncRefreshGate/.test(core))
test('useSectionRefresh hook exists', /useSectionRefresh/.test(hook))
test('ListingCard does not attach visibility listeners', (() => {
  const i = market.indexOf('function ListingCard')
  const j = market.indexOf('\nfunction ', i + 10)
  const card = market.slice(i, j)
  return !card.includes('visibilitychange') && !card.includes('ghc:marketplace-refresh')
})())
test('MarketplaceScreen uses useSectionRefresh', /useSectionRefresh\(\s*"marketplace"/.test(market))
test('Communities reloads on soft refresh tick', /directoryTick/.test(communities) && /useSectionRefresh\(\s*"communities"/.test(communities))
test('Feed manual refresh emits section event', /emitSectionRefresh\("feed"/.test(feed))
test('Soft refresh min interval defaults are bounded', /12_000/.test(core) || /minIntervalMs/.test(core))
test('Async refresh handlers remain in-flight until their promise settles', /Promise\.resolve\(result\)\.finally/.test(core))
test('Feed foreground refresh uses the shared coordinator', /useSectionRefresh\(\"feed\"/.test(feed) && !/window\.addEventListener\(\"focus\"/.test(feed))
test('Wallet foreground refresh uses the shared coordinator', /useSectionRefresh\(\"wallet\"/.test(wallet) && !/window\.addEventListener\(\"focus\"/.test(wallet))
test('Notification foreground refresh uses the shared coordinator', /useSectionRefresh\(\"notifications\", refresh/.test(notifications) && !/window\.addEventListener\(\"focus\"/.test(notifications))

const failed = checks.filter((x) => !x).length
console.log(`\nSection refresh hardening: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
