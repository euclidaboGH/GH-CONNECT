#!/usr/bin/env node
/** Phase 9 continuation 8: prevent avoidable root crashes and improve recovery. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const layout = read('app/layout.tsx')
const safeUrl = read('lib/safe-metadata-base.ts')
const routeError = read('app/error.tsx')
const globalError = read('app/global-error.tsx')
const boundary = read('lib/error-boundary.tsx')
const retry = read('lib/network-resilience.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['root layout uses guarded metadata URL parsing', layout.includes('resolveSafeMetadataBase') && !/new URL\(appUrl/.test(layout)],
  ['invalid metadata URL returns undefined instead of throwing', /catch\s*\{\s*return undefined/.test(safeUrl)],
  ['metadata URL accepts only HTTP(S)', /parsed\.protocol !== "https:" && parsed\.protocol !== "http:"/.test(safeUrl)],
  ['metadata URL rejects embedded credentials', /parsed\.username \|\| parsed\.password/.test(safeUrl)],
  ['route retry preserves the current deep link', /onClick=\{\(\) => window\.location\.reload\(\)\}/.test(routeError)],
  ['route error has a support recovery path', /href="\/support"/.test(routeError) && /Support/.test(routeError)],
  ['root error has a support recovery path', /href="\/support"/.test(globalError) && /Open Support/.test(globalError)],
  ['route error tells users to check pending actions', /Check pending actions/.test(routeError)],
  ['global error tells users to check pending actions', /Check pending actions/.test(globalError)],
  ['custom boundary clears automatic retry timer on unmount', /componentWillUnmount\(\)/.test(boundary) && /clearTimeout\(this\.autoRetryTimer\)/.test(boundary)],
  ['custom boundary avoids unsupported saved-data guarantee', !/do not intentionally change your saved account data/i.test(boundary)],
  ['network retry bounds caller-supplied retry settings', /Math\.min\(8, Math\.floor\(requested\.maxRetries\)\)/.test(retry) && /Math\.min\(120_000, requested\.timeoutMs\)/.test(retry)],
  ['network retry clears timeout after completion and before backoff', /finally\s*\{\s*if \(timeoutId !== undefined\) clearTimeout\(timeoutId\)/.test(retry) && /timeoutId = undefined/.test(retry)],
  ['runtime tests and checker are wired into build and static verification', ['prebuild','verify:static'].every((key) => pkg.scripts[key].includes('check-roadmap-phase9-continuation8.mjs') && pkg.scripts[key].includes('test-phase9-resilience-runtime.mjs'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 9 continuation 8: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Phase 9 continuation 8 checks failed')
