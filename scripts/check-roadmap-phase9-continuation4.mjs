#!/usr/bin/env node
/** Phase 9 continuation 4: resilient keyboard focus and route recovery contracts. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const a11y = readFileSync('lib/accessibility.ts', 'utf8')
const compose = readFileSync('components/ghc/unified-compose.tsx', 'utf8')
const notFound = readFileSync('app/not-found.tsx', 'utf8')
const routeError = readFileSync('app/error.tsx', 'utf8')
const globalError = readFileSync('app/global-error.tsx', 'utf8')
const checks = [
  ['focus trap dynamically queries focusable controls', /const getFocusable = \(\): HTMLElement\[\] => Array\.from\(container\.querySelectorAll/.test(a11y)],
  ['focus trap excludes disabled and hidden controls', /hasAttribute\("disabled"\)/.test(a11y) && /closest\('\[hidden\], \[inert\], \[aria-hidden="true"\]'\)/.test(a11y)],
  ['focus trap excludes visually hidden controls', /getComputedStyle\(element\)/.test(a11y) && /getClientRects\(\)\.length > 0/.test(a11y)],
  ['focus trap wraps forward Tab from last control', /!event\.shiftKey && \(active === last/.test(a11y) && /focusWithoutScroll\(first\)/.test(a11y)],
  ['focus trap wraps reverse Tab from first control', /event\.shiftKey && \(active === first/.test(a11y) && /focusWithoutScroll\(last\)/.test(a11y)],
  ['empty focus trap remains keyboard-contained', /focusWithoutScroll\(container\)/.test(a11y) && /event\.preventDefault\(\)/.test(a11y)],
  ['focus trap supports autofocus when available', /querySelector<HTMLElement>\("\[autofocus\]"\)/.test(a11y)],
  ['focus trap restores prior focus after release', /previouslyFocused\?\.isConnected/.test(a11y) && /focusWithoutScroll\(previouslyFocused\)/.test(a11y)],
  ['focus trap cleanup is idempotent', /if \(released\) return/.test(a11y) && /container\.removeEventListener\("keydown"/.test(a11y)],
  ['focus operations avoid unnecessary page scrolling', /focus\(\{ preventScroll: true \}\)/.test(a11y)],
  ['compose surface releases its trap on close/unmount', /const release = a11y\.createFocusTrap\(root,/.test(compose) && /return \(\) => release\(\)/.test(compose)],
  ['404 page avoids unsupported claim that saved progress is unchanged', !/saved progress have not been changed/i.test(notFound)],
  ['404 route retains an explicit route-home recovery action', /href="\/"/.test(notFound) && /Open GreenHaven/.test(notFound)],
  ['404 route moves focus to a recovery action', /homeRef\.current\?\.focus\(\)/.test(notFound)],
  ['route error avoids rendering raw exception details', !/\{\s*error\.message\s*\}/.test(routeError) && !/error\.stack/.test(routeError)],
  ['route error support reference remains sanitized', /\^\[a-zA-Z0-9_-\]\{1,80\}\$/.test(routeError)],
  ['global error support reference remains sanitized', /\^\[a-zA-Z0-9_-\]\{1,80\}\$/.test(globalError)],
  ['global error offers retry and reload actions', /reset\(\)/.test(globalError) && /window\.location\.reload\(\)/.test(globalError)],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`\nPhase 9 continuation 4: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Phase 9 continuation 4 checks failed')
