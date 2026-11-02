#!/usr/bin/env node
/** Phase 9 continuation 3: truthful announcements and mobile resilience contracts. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const announcer = readFileSync('components/ghc/accessibility-announcer.tsx', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')
const shell = readFileSync('components/ghc/app.tsx', 'utf8')
const checks = [
  ['navigation announcement describes selection, not unverified loading completion', /section selected\./.test(announcer) && !/section loaded\./.test(announcer)],
  ['navigation announcement sanitizes and bounds dynamic labels', /replace\(\/\[\\u0000-\\u001f\\u007f\]\/g, " "\)/.test(announcer) && /slice\(0, 80\)/.test(announcer)],
  ['announcement remains polite, atomic, and does not steal focus', /aria-live="polite"/.test(announcer) && /aria-atomic="true"/.test(announcer) && !/\.focus\(/.test(announcer)],
  ['mobile viewport remains zoomable for low-vision users', /maximumScale:\s*5/.test(layout) && /userScalable:\s*true/.test(layout)],
  ['mobile app shell uses dynamic viewport sizing', /height:\s*100dvh/.test(css) && /min-height:\s*100dvh/.test(css)],
  ['main app navigation has a stable main landmark target', /id="ghc-main-content"/.test(shell) && /tabIndex=\{-1\}/.test(shell)],
  ['safe-area padding remains applied to bottom navigation', /env\(safe-area-inset-bottom/.test(shell)],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nPhase 9 continuation 3: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Phase 9 continuation 3 checks failed')
