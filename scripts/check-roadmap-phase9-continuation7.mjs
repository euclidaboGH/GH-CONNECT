#!/usr/bin/env node
/** Phase 9 continuation 7: accessible recovery journeys and route-state contracts. */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  if (name === 'api' || name.startsWith('.')) return []
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : /\/page\.tsx?$/.test(path) ? [path] : []
})
const routes = walk('app')
const e2e = readFileSync('e2e/phase9-continuation7-accessibility.spec.ts', 'utf8')
const notFound = readFileSync('app/not-found.tsx', 'utf8')
const skip = readFileSync('components/ghc/skip-to-content.tsx', 'utf8')
const loading = readFileSync('app/loading.tsx', 'utf8')
const error = readFileSync('app/error.tsx', 'utf8')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const checks = [
  ['route inventory is non-empty and discovers at least five pages', routes.length >= 5],
  ['not-found title is programmatically focusable', /id="not-found-title"/.test(notFound) && /homeRef\.current\?\.focus\(\)/.test(notFound)],
  ['not-found recovery offers home and back choices', /Open GreenHaven/.test(notFound) && /Go back/.test(notFound)],
  ['skip-to-content focuses the actual main landmark', /target\.focus\(\{ preventScroll: true \}\)/.test(skip) && /href="#ghc-main-content"/.test(skip)],
  ['skip navigation respects reduced-motion preferences', /prefers-reduced-motion: reduce/.test(skip)],
  ['loading boundary exposes a named busy status', /role="status"/.test(loading) && /aria-busy="true"/.test(loading) && /aria-label="Loading GreenHaven"/.test(loading)],
  ['route error focuses heading and cleans up connectivity listeners', /titleRef\.current\?\.focus/.test(error) && /removeEventListener\("online"/.test(error) && /removeEventListener\("offline"/.test(error)],
  ['browser suite tests unknown-route recovery focus', /toBeFocused\(\)/.test(e2e) && /unknown-route recovery/.test(e2e)],
  ['browser suite exercises reduced motion', /reducedMotion: "reduce"/.test(e2e)],
  ['browser suite verifies zoom-friendly viewport and keyboard focus', /user-scalable/.test(e2e) && /page\.keyboard\.press\("Tab"\)/.test(e2e)],
  ['browser suite spans compact phone, phone and desktop', /width: 320/.test(e2e) && /width: 390/.test(e2e) && /width: 1440/.test(e2e)],
  ['checker is wired into prebuild and static verification', pkg.scripts.prebuild.includes('check-roadmap-phase9-continuation7.mjs') && pkg.scripts['verify:static'].includes('check-roadmap-phase9-continuation7.mjs')],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`\nPhase 9 continuation 7: ${checks.length - failed}/${checks.length} passed; inventoried ${routes.length} page routes`)
assert.equal(failed, 0, 'Phase 9 continuation 7 checks failed')
