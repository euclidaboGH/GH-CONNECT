#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const notification = read('components/ghc/notification-bell.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const messages = read('components/ghc/message-screen.tsx')
const communities = read('components/ghc/communities-screen.tsx')
const marketplace = read('components/ghc/marketplace-screen.tsx')
const failures = []
let total = 0
function check(condition, label) {
  total += 1
  if (condition) console.log(`PASS ${label}`)
  else failures.push(label)
}

check(notification.includes('IdentityService.subscribe'), 'notification centre follows canonical session identity')
check(notification.includes('requestIdentity !== IdentityService.getCurrentUserId()'), 'notification responses are rejected after account changes')
check(notification.includes('refreshGenerationRef.current'), 'notification refreshes use a generation fence')
check(notification.includes('activeRefreshControllerRef.current?.abort()'), 'identity changes and unmount abort stale notification requests')
check((notification.match(/signal: controller\.signal/g) || []).length === 4, 'all durable notification sources share the cancellable request signal')
check(notification.includes('setItems([])') && notification.includes('setUnread(0)'), 'previous-account notification rows and counts are cleared')
check(notification.includes('generation === refreshGenerationRef.current'), 'superseded refresh cannot unlock a newer refresh')
check(feed.includes('aria-selected={active}') && feed.includes('aria-pressed={active}'), 'feed filters expose selected state accessibly')
check(messages.includes('role="tab"') && messages.includes('aria-selected={filter === f.id}'), 'inbox filters expose tab selection state')
check(communities.includes('aria-pressed={categoryFilter === cat}') && communities.includes('aria-pressed={privacyFilter === id}'), 'community category and access filters expose selected state')
check(marketplace.includes('role="group" aria-label="Categories"') && marketplace.includes('aria-pressed={category === c}'), 'marketplace category controls use toggle semantics')
check(pkg.version === lock.version && pkg.version === lock.packages?.['']?.version, 'package and lockfile versions agree')
check(release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`), 'in-app release version matches package')

if (failures.length) {
  console.error(`\nPhase 30 cross-surface reliability: ${failures.length} failure(s)`)
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}
console.log(`\nPhase 30 cross-surface reliability: ${total}/${total} checks passed.`)
