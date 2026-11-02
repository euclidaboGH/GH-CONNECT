#!/usr/bin/env node
/** Phase 9: accessible, recoverable navigation and error-boundary behavior. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const routeError = readFileSync('app/error.tsx', 'utf8')
const globalError = readFileSync('app/global-error.tsx', 'utf8')
const loading = readFileSync('app/loading.tsx', 'utf8')
const accessibility = readFileSync('lib/accessibility.ts', 'utf8')
const skipLink = readFileSync('components/ghc/skip-to-content.tsx', 'utf8')
const checks = [
  ['route error never renders raw exception message', !/\{\s*error\.message\s*\}/.test(routeError) && !/error\.stack/.test(routeError)],
  ['route error exposes only a bounded safe correlation identifier', /\^\[a-zA-Z0-9_-\]\{1,80\}\$/.test(routeError) && /Support reference/.test(routeError)],
  ['root error exposes a safe correlation identifier', /Support reference/.test(globalError) && /\^\[a-zA-Z0-9_-\]\{1,80\}\$/.test(globalError)],
  ['route error listens for online/offline changes and cleans up listeners', /addEventListener\("online"/.test(routeError) && /addEventListener\("offline"/.test(routeError) && /removeEventListener\("online"/.test(routeError) && /removeEventListener\("offline"/.test(routeError)],
  ['offline state gives actionable guidance without claiming data safety', /You appear to be offline/.test(routeError) && !/saved data have not been intentionally changed/.test(routeError)],
  ['route error retry controls have visible keyboard focus styles', (routeError.match(/focus-visible:ring-2/g) || []).length >= 2],
  ['retry controls respect reduced-motion preferences', /motion-reduce:transform-none/.test(routeError) && /motion-reduce:transition-none/.test(routeError)],
  ['global error retains retry and reload recovery actions', /reset\(\)/.test(globalError) && /window\.location\.reload\(\)/.test(globalError)],
  ['loading state announces status to assistive technology', /role="status"/.test(loading) && /aria-live="polite"/.test(loading) && /aria-busy="true"/.test(loading)],
  ['loading pulse respects reduced-motion preferences', /motion-reduce:animate-none/.test(loading)],
  ['screen-reader announcements clear before repeat and use a bounded delay', /ariaLive\.textContent = ""/.test(accessibility) && /slice\(0, 240\)/.test(accessibility) && /announcementTimer/.test(accessibility)],
  ['screen-reader announcements create a live region when needed', /function getLiveRegion\(\)/.test(accessibility) && /aria-live-region/.test(accessibility)],
  ['skip link targets an existing main landmark instead of a missing fragment', /document\.getElementById\("ghc-main-content"\) \?\? document\.getElementById\("main-content"\)/.test(accessibility) && /if \(!target\) return/.test(accessibility)],
  ['authenticated shell has a single skip-to-content destination', /href="#ghc-main-content"/.test(skipLink) && /id="ghc-main-content"/.test(readFileSync('components/ghc/app.tsx', 'utf8'))],
  ['global reduced-motion stylesheet overrides animation and scrolling', /prefers-reduced-motion:\s*reduce/.test(readFileSync('app/globals.css', 'utf8')) && /scroll-behavior:\s*auto/.test(readFileSync('app/globals.css', 'utf8'))],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`\nPhase 9 navigation and resilience: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Phase 9 navigation/resilience checks failed')
