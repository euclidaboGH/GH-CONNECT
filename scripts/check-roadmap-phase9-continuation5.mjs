#!/usr/bin/env node
/** Phase 9 continuation 5: keyboard containment, route recovery and mobile focus resilience. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const a11y = readFileSync('lib/accessibility.ts', 'utf8')
const compose = readFileSync('components/ghc/unified-compose.tsx', 'utf8')
const skip = readFileSync('components/ghc/skip-to-content.tsx', 'utf8')
const routeError = readFileSync('app/error.tsx', 'utf8')
const globalError = readFileSync('app/global-error.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const checks = [
  ['focus trap supports optional Escape dismissal without forcing every caller to close', /options: \{ onEscape\?: \(\) => void; restoreFocus\?: boolean \}/.test(a11y) && /if \(event\.key === "Escape" && options\.onEscape\)/.test(a11y)],
  ['focus trap can be configured not to restore prior focus', /options\.restoreFocus !== false/.test(a11y)],
  ['focus trap excludes aria-disabled controls', /getAttribute\("aria-disabled"\) === "true"/.test(a11y)],
  ['focus trap includes valid summary and titled iframe controls', /"summary", "iframe\[title\]"/.test(a11y)],
  ['focus trap contains programmatic focus escaping the surface', /document\.addEventListener\("focusin", handleFocusIn, true\)/.test(a11y) && /!container\.contains\(target\)/.test(a11y)],
  ['focus trap removes document listeners during cleanup', /document\.removeEventListener\("focusin", handleFocusIn, true\)/.test(a11y)],
  ['compose Escape dismissal is disabled during publishing', /onEscape: isPublishing \? undefined : \(\) => onOpenChange\(false\)/.test(compose)],
  ['compose focus trap lifecycle tracks publish state', /\[open, isPublishing, onOpenChange\]/.test(compose)],
  ['skip link explicitly focuses the main landmark', /target\.focus\(\{ preventScroll: true \}\)/.test(skip)],
  ['skip link respects reduced motion', /prefers-reduced-motion: reduce/.test(skip) && /behavior: "smooth"/.test(skip)],
  ['route error focuses its heading for recovery context', /titleRef\.current\?\.focus\(\{ preventScroll: true \}\)/.test(routeError) && /ref=\{titleRef\} tabIndex=\{-1\}/.test(routeError)],
  ['global error focuses its heading and removes network listeners', /titleRef\.current\?\.focus\(\{ preventScroll: true \}\)/.test(globalError) && /removeEventListener\("offline"/.test(globalError)],
  ['global error gives explicit offline recovery guidance', /You appear to be offline/.test(globalError) && /role="status"/.test(globalError)],
  ['global focus indicators have a consistent visible outline', /:where\(a, button, input, select, textarea, \[role="button"\], \[tabindex\]\):focus-visible/.test(css)],
  ['mobile focused fields have safe-area-aware scroll margins', /scroll-margin-block: max\(5rem, env\(safe-area-inset-top/.test(css)],
  ['global reduced-motion mode suppresses smooth scrolling', /@media \(prefers-reduced-motion: reduce\)/.test(css) && /scroll-behavior: auto !important/.test(css)],
  ['continuation checker is wired into prebuild and static verification', pkg.scripts.prebuild.includes('check-roadmap-phase9-continuation5.mjs') && pkg.scripts['verify:static'].includes('check-roadmap-phase9-continuation5.mjs')],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`\nPhase 9 continuation 5: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Phase 9 continuation 5 checks failed')
