#!/usr/bin/env node
/** Phase II #11–13: topic controls, ranking hygiene and constrained-device media. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const engine = read('lib/feed-ranking-engine.ts')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const mobile = read('lib/mobile-performance.ts')
const image = read('components/ghc/lazy-image.tsx')
const video = read('components/ghc/enhanced-post-card.tsx')
const messages = read('components/ghc/message-screen.tsx')
const market = read('components/ghc/marketplace-screen.tsx')
const screenshots = read('scripts/capture-phase2-responsive-screenshots.mjs')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['topic normalization merges hashtags and content tags', /export function getPostTopicSet[\s\S]*?extractHashtags[\s\S]*?post\.hashtags/.test(engine)],
  ['topic tags are length and character bounded', /\^\[\\p\{L\}\\p\{N\}_\]\{2,32\}\$/.test(engine)],
  ['muted topics are hard exclusions', /excluded\.has\(topic\)/.test(engine)],
  ['selected topics narrow the feed', /included\.some\(\(topic\) => topics\.has\(topic\)\)/.test(engine)],
  ['topic filters apply to For You', /rankForYouFeed[\s\S]*?matchesTopicControls\(post, context\)/.test(engine)],
  ['topic filters apply to Following', /rankFollowingFeed[\s\S]*?matchesTopicControls\(post, context\)/.test(engine)],
  ['topic filters apply to Trending and Latest', /rankTrendingFeed[\s\S]*?matchesTopicControls\(post, context\)[\s\S]*?rankLatestFeed[\s\S]*?matchesTopicControls\(post, context\)/.test(engine)],
  ['topic filters apply to Friends and Communities', /rankFriendsFeed[\s\S]*?matchesTopicControls\(post, context\)[\s\S]*?rankCommunitiesFeed[\s\S]*?matchesTopicControls\(post, context\)/.test(engine)],
  ['topic filters apply to Saved', /rankSavedFeed[\s\S]*?matchesTopicControls\(p, context\)/.test(engine)],
  ['feed passes durable muted-user state into the ranking engine', feed.includes("mutedUserIds: Array.from(new Set([...(mutedUsers || [])")],
  ['topic preferences are stored per account on device', /ghc\.feed-topic-preferences:\$\{feedPreferenceOwnerId\}/.test(feed)],
  ['topic controls expose accessible selected and muted states', /aria-pressed=\{selectedTopic === topic\}/.test(feed) && /aria-pressed=\{mutedTopics\.includes\(topic\)\}/.test(feed)],
  ['muted topics can always be restored even after matching posts disappear', /Muted feed topics[\s\S]*?toggleMutedTopic\(topic\)[\s\S]*?Unmute topic/.test(feed)],
  ['topic selection and mute controls trigger feed recomputation', /includedTopics: selectedTopic \? \[selectedTopic\] : \[\]/.test(feed) && /excludedTopics: mutedTopics/.test(feed)],
  ['low-power devices use a smaller initial feed batch', /if \(profile\.lowPower\) return 3/.test(mobile)],
  ['adaptive feed batch is applied after hydration to avoid SSR mismatch', /useState<number>\(MOBILE_PAGE_SIZES\.feed\)[\s\S]*?useEffect\(\(\) => \{ setDisplayedPostsCount\(getAdaptiveFeedPageSize\(\)\) \}, \[\]\)/.test(feed)],
  ['higher-capability devices use a bounded larger feed batch', /hardwareConcurrency >= 8\) return 7/.test(mobile)],
  ['lazy images support eager priority and responsive size hints', /loading=\{priority \? "eager" : "lazy"\}/.test(image) && /fetchPriority=\{priority \? "high" : "auto"\}/.test(image) && /sizes=\{sizes\}/.test(image)],
  ['first visible feed image alone receives eager priority', /priority=\{index === 0\}/.test(feed) && /priority=\{priority\}/.test(video)],
  ['feed videos do not preload metadata for every card', /<DurableVideo src=\{post\.video\} preload="none"/.test(video)],
  ['ranking engagement inputs are finite and bounded', /function calculateEngagementScore[\s\S]*?Number\.isFinite\(number\)[\s\S]*?Math\.min\(cap, number\)/.test(engine)],
  ['future timestamps cannot receive extra freshness boosts', /Math\.max\(0, \(Date\.now\(\) - post\.createdAt\)/.test(engine)],
  ['shared title token migrated to messages and marketplace', messages.includes('gh-type-title') && market.includes('gh-type-title')],
  ['responsive screenshot harness covers phones, tablets, desktop and ultra-wide', ['360, height: 800', '768, height: 1024', '1024, height: 768', '1440, height: 900', '1920, height: 1080'].every((v) => screenshots.includes(v))],
  ['responsive screenshot harness covers light and dark themes', /\['light', 'dark'\]/.test(screenshots)],
  ['responsive screenshot harness detects document overflow and app-shell width', screenshots.includes('documentWidth > dimensions.viewportWidth + 2') && screenshots.includes('box.width > viewport.width + 1')],
  ['responsive screenshot harness captures canonical navigation destinations', screenshots.includes('nav[aria-label=\"Main navigation\"] button') && screenshots.includes('safeLabel')],
  ['responsive screenshot command is registered', pkg.scripts['capture:phase2-responsive']?.includes('capture-phase2-responsive-screenshots.mjs')],
  ['new feed controls/performance gate is registered in prebuild and static verification', ['prebuild', 'verify:static'].every((key) => pkg.scripts[key]?.includes('check-phase2-feed-controls-performance.mjs'))],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`Phase II feed controls/performance contract: ${checks.length - failures}/${checks.length} passed`)
assert.equal(failures, 0, 'Phase II feed controls/performance contract failed')
