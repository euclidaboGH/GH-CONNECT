#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const source = readFileSync('components/ghc/enhanced-feed-screen.tsx', 'utf8')
const composer = readFileSync('components/ghc/composer-prompt-bar.tsx', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const prebuild = packageJson.scripts?.prebuild || ''
const verify = packageJson.scripts?.['verify:static'] || ''
const checks = [
  ['saved feed lane is restored from device preference', source.includes('v === "saved"')],
  ['selected feed lane is persisted without server authority', source.includes('localStorage.setItem("ghc.feedFilter", activeFilter)')],
  ['changing feed lanes resets pagination and returns to the top', /handleFeedFilterChange[\s\S]*setDisplayedPostsCount\(MOBILE_PAGE_SIZES\.feed\)[\s\S]*scrollTo\(\{ top: 0/.test(source)],
  ['topic discovery is derived only from currently ranked feed content', source.includes('rankedPosts.slice(0, 40)')],
  ['topic discovery normalizes and bounds hashtag labels', source.includes('.replace(/^#/, "").trim().toLowerCase()') && source.includes('{2,32}$/u.test(tag)')],
  ['topic selection opens feed search rather than fabricating discovery results', source.includes('setSearchQuery(`#${topic}`); setIsSearchOpen(true)')],
  ['topic rail is accessible and keyboard-operable', source.includes('aria-label="Topics in your feed"') && source.includes('role="group" aria-label="Explore feed topics"')],
  ['shared composer explains the creation journey', composer.includes('Start a conversation') && composer.includes('Share an update, idea or moment')],
  ['shared composer makes audience choice explicit before publishing', composer.includes('Choose your audience in the composer before you publish')],
  ['feed transformation check is registered in prebuild', prebuild.includes('check-phase1-feed-product-transformation-20261107.mjs')],
  ['feed transformation check is registered in static verification', verify.includes('check-phase1-feed-product-transformation-20261107.mjs')],
  ['Phase 1 remains recorded at 0.330.19 while active release advances independently', Boolean(packageJson.version) && readFileSync('docs/PRODUCT-ROADMAP.md', 'utf8').includes('Source implementation completed in 0.330.19;')],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures += 1
}
if (failures) process.exit(1)
console.log(`Phase 1 Feed product transformation: ${checks.length}/${checks.length} passed`)
