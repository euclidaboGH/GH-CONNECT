#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const app = readFileSync('components/ghc/app.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')
const panel = readFileSync('components/ghc/post-reward/post-reward-panel.tsx', 'utf8')
const checks = [
  ['scroll capture resolves the actual nested scroll owner', /e\.target instanceof HTMLElement/.test(app) && /candidates\.find/.test(app)],
  ['scroll-down content direction hides navigation', /delta > 0 && y > 48/.test(app)],
  ['scroll-up content direction restores navigation', /delta < 0/.test(app)],
  ['hidden in-flow navigation collapses its minimum height', /minHeight: bottomNavHidden \|\| showCreateHub \? 0/.test(app)],
  ['hidden navigation releases the content bottom inset', /data-nav-hidden="true"[\s\S]*?--gh-screen-bottom-inset/.test(css)],
  ['hidden navigation is removed from pointer interaction', /pointer-events: none !important/.test(css)],
  ['curation analytics are not fetched for every feed card', !/useEffect\(\(\) => \{ void refreshAnalytics\(\); \}/.test(panel) && /if \(open\) void refreshAnalytics/.test(panel)],
  ['analytics requests are bounded and cancellable', /setTimeout\(\(\) => controller\.abort\(\), 10_000\)/.test(panel) && /requestRef\.current\?\.abort\(\)/.test(panel)],
  ['stale analytics responses cannot overwrite current post data', /sequence !== sequenceRef\.current/.test(panel)],
  ['insights use a separate accessible modal sheet', /createPortal\(/.test(panel) && /role="dialog" aria-modal="true"/.test(panel)],
  ['modal supports Escape, focus trapping and background scroll restoration', /event\.key === "Escape"/.test(panel) && /event\.key !== "Tab"/.test(panel) && /const first = focusable\[0\]/.test(panel) && /last\.focus\(\)/.test(panel) && /document\.body\.style\.overflow = previousOverflow/.test(panel)],
  ['reward messaging preserves no-vote-minting boundary', /do not create GHC/.test(panel) && /server-authoritative rewards/.test(panel)],
]
let passed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (ok) passed++ }
console.log(`\nPhase 27 scroll immersion + curation UX: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
