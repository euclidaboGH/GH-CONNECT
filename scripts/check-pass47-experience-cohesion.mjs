import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const wrapper = read('components/app-wrapper.tsx')
const globalError = read('app/global-error.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const app = read('components/ghc/app.tsx')
const page = read('app/page.tsx')

assert.match(wrapper, /useState<"online" \| "offline" \| "restored">/, 'global connection state is explicit')
assert.match(wrapper, /offlineSupport\.setupListeners\(onOnline, onOffline\)/, 'network listeners are cleaned up through shared offline support')
assert.match(wrapper, /You’re offline\. Live updates and new actions may be unavailable\./, 'offline state is visible and explains impact')
assert.match(wrapper, /Check pending actions before retrying\./, 'reconnect state discourages duplicate retries')
assert.match(wrapper, /clearTimeout\(restoredTimer\)/, 'reconnect notice timer is cleaned up')
assert.doesNotMatch(globalError, /error\?\.message/, 'root error boundary does not expose raw exception messages')
assert.match(globalError, /correlationId = typeof error\?\.digest === \"string\"[\s\S]*?Support reference/, 'root error boundary retains a sanitized, user-visible correlation reference')
const feedSkeleton = feed.slice(feed.indexOf('function FeedSkeleton()'), feed.indexOf('export function EnhancedFeedScreen'))
assert.match(feedSkeleton, /gh-skeleton/, 'feed skeleton uses shared shimmer treatment')
assert.doesNotMatch(feedSkeleton, /animate-pulse/, 'feed skeleton avoids conflicting pulse animation')
const tabFallback = app.slice(app.indexOf('function TabScreenFallback'), app.indexOf('function prefetchTabChunks'))
assert.match(tabFallback, /gh-skeleton/, 'tab fallback uses shared shimmer treatment')
assert.doesNotMatch(tabFallback, /animate-pulse/, 'tab fallback avoids conflicting pulse animation')
console.log('Pass 47 experience cohesion checks: PASS (network feedback, safe recovery, consistent loading surfaces)')
