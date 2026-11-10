#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const logo = read('components/ghc/brand-logo.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const context = read('contexts/ghc-context.tsx')
const design = read('lib/design-system.ts')
const checks = [
  ['logo shared image props own decoding once', /decoding:\s*["']async["']/.test(logo) && !/loading=["']lazy["'] decoding=["']async["']/.test(logo)],
  ['logo LCP priority uses high fetch priority', /priority\s*\?\s*\{\s*fetchPriority:\s*["']high["']/.test(logo)],
  ['non-priority logo remains lazy loaded', /:\s*\{\s*loading:\s*["']lazy["']/.test(logo)],
  ['logo dimensions reserve layout space', /width:\s*s\.w/.test(logo) && /height:\s*s\.h/.test(logo)],
  ['primary logo has accessible name', /alt=["']GreenHaven["']/.test(logo)],
  ['decorative dark logo is hidden from assistive tech', /aria-hidden=["']true["']/.test(logo)],
  ['dark logo variant shares the common image policy', /src=\{s\.dark\} className=\{base\} alt=["']GreenHaven["'] \{\.\.\.common\}/.test(logo)],
  ['feed context exposes muted account IDs', /mutedUsers:\s*string\[\]/.test(context.slice(context.indexOf('const GHCFeedContext'), context.indexOf('const GHCCommunityContext')))],
  ['feed context value supplies muted account IDs', /mutedUsers:\s*mutedIdsForUi/.test(context)],
  ['feed ranking receives muted account IDs', /mutedUserIds:\s*Array\.from\(new Set\(\[\.\.\.\(mutedUsers \|\| \[\]\), \.\.\.\(settings\?\.mutedUsers \|\| \[\]\)\]/.test(feed)],
  ['feed ranking merges blocked IDs from typed settings', /settings\?\.blockedUsers/.test(feed)],
  ['feed ranking avoids unsafe settings cast for mute IDs', !/\(settings as any\)\?\.mutedUsers/.test(feed)],
  ['muted IDs are included in feed ranking dependencies', /selectedTopic, mutedTopics, mutedUsers\]/.test(feed)],
  ['layout shell width token is unique', (design.match(/contentMax:/g) || []).length === 1],
  ['inner content width has a separate semantic token', /contentWidth:\s*["']var\(--gh-content-max\)["']/.test(design)],
  ['outer shell width uses its dedicated token', /contentMax:\s*["']var\(--gh-shell-content-max\)["']/.test(design)],
  ['feed loading skeleton announces status', /role=["']status["']/.test(feed)],
  ['feed loading skeleton exposes busy state', /aria-busy=["']true["']/.test(feed)],
  ['feed filter persistence is guarded against storage failure', /localStorage\.setItem\(["']ghc\.feedFilter["']/.test(feed) && /catch\s*\{\s*\/\* storage may be unavailable \*\//.test(feed)],
  ['reduced-data preference is respected at initialization', /useState\(\(\)\s*=>\s*preferReducedData\(\)\)/.test(feed)],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`Run #241 essentials: ${checks.length - failed}/${checks.length}`)
if (failed) process.exitCode = 1
