#!/usr/bin/env node
/** Phase 9 continuation 6: browser-level recovery coverage and route boundary inventory. */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = 'app'
const routeFiles = []
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'api' || entry.startsWith('.')) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path)
    else if (entry === 'page.tsx' || entry === 'page.ts' || entry === 'route.tsx' || entry === 'route.ts') routeFiles.push(path)
  }
}
walk(root)
const pageRoutes = routeFiles.filter((p) => p.endsWith('/page.tsx') || p.endsWith('/page.ts'))
const layout = readFileSync('app/layout.tsx', 'utf8')
const error = readFileSync('app/error.tsx', 'utf8')
const globalError = readFileSync('app/global-error.tsx', 'utf8')
const notFound = readFileSync('app/not-found.tsx', 'utf8')
const e2e = readFileSync('e2e/phase9-navigation-resilience.spec.ts', 'utf8')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const checks = [
  ['route inventory discovered application page routes', pageRoutes.length >= 5],
  ['root layout retains a viewport with user zoom enabled', /userScalable:\s*true/.test(layout) && /maximumScale:\s*5/.test(layout)],
  ['route-level error boundary offers retry and sanitized correlation reference', /onClick=\{\(\) => reset\(\)\}/.test(error) && /data-testid="error-correlation-id"/.test(error)],
  ['global error boundary offers retry and reload recovery', /onClick=\{\(\) => reset\(\)\}/.test(globalError) && /window\.location\.reload\(\)/.test(globalError)],
  ['not-found screen offers explicit non-redirecting recovery choices', /Open GreenHaven/.test(notFound) && /Go back/.test(notFound) && /router\.back\(\)/.test(notFound)],
  ['browser suite covers offline and online restoration', /context\.setOffline\(true\)/.test(e2e) && /context\.setOffline\(false\)/.test(e2e)],
  ['browser suite covers four responsive viewport classes', /width: 320/.test(e2e) && /width: 430/.test(e2e) && /width: 768/.test(e2e) && /width: 1440/.test(e2e)],
  ['browser suite checks unknown routes without accepting server failures', /__phase9-route-does-not-exist__/.test(e2e) && /toBeLessThan\(500\)/.test(e2e)],
  ['checker is wired into prebuild and verify:static', pkg.scripts.prebuild.includes('check-roadmap-phase9-continuation6.mjs') && pkg.scripts['verify:static'].includes('check-roadmap-phase9-continuation6.mjs')],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`\nPhase 9 continuation 6: ${checks.length - failed}/${checks.length} passed; inventoried ${pageRoutes.length} page routes`)
assert.equal(failed, 0, 'Phase 9 continuation 6 checks failed')
