import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const feed = readFileSync(new URL('../components/ghc/enhanced-feed-screen.tsx', import.meta.url), 'utf8')
const drafts = readFileSync(new URL('../lib/creator/post-drafts.ts', import.meta.url), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const checks = [
  ['feed filter loads from device preference', feed.includes('getItem("ghc.feedFilter")')],
  ['feed filter persists when changed', feed.includes('setItem("ghc.feedFilter", activeFilter)')],
  ['reset restores default feed filter', feed.includes('setActiveFilter("for-you")')],
  ['reset persists default filter', feed.includes('setItem("ghc.feedFilter", "for-you")')],
  ['focus mode persists', feed.includes('setItem("ghc.feedFocusMode", focusMode ? "1" : "0")')],
  ['draft reads are guarded against malformed JSON', drafts.includes('JSON.parse(raw)') && drafts.includes('catch {\n    return []')],
  ['draft media URLs are bounded', drafts.includes('u.length <= 2048')],
  ['draft media count is bounded', drafts.includes('.slice(0, 10)')],
  ['draft hashtags and mentions are bounded', drafts.includes('.slice(0, 50)')],
  ['phase checker registered in static verification', pkg.scripts['verify:static']?.includes('check-roadmap-phase2-feed-social.mjs')],
]
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  assert.ok(ok, label)
}
console.log(`Phase 2 feed/social checks: ${checks.length}/${checks.length} passed`)
