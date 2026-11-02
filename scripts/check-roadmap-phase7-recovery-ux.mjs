#!/usr/bin/env node
/** Phase 7 continuation: keep recoverable UI failures actionable and avoid leaking exception text. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const boundary = readFileSync('lib/error-boundary.tsx', 'utf8')
const routeError = readFileSync('app/error.tsx', 'utf8')
const globalError = readFileSync('app/global-error.tsx', 'utf8')
const upload = readFileSync('lib/media/upload-client.ts', 'utf8')
const mediaMessages = readFileSync('lib/media/user-messages.ts', 'utf8')
const checks = [
  ['component boundary keeps an in-place retry action', /onClick=\{this\.retry\}/.test(boundary)],
  ['component boundary provides a full-app reload escape hatch', /onClick=\{\(\) => window\.location\.reload\(\)\}/.test(boundary)],
  ['component boundary does not render raw exception messages', !/\{this\.state\.error\.message\}/.test(boundary) && !/Technical details/.test(boundary)],
  ['component boundary uses a stable, non-secret diagnostic reference', /SCREEN_RENDER_FAILED/.test(boundary) && /APP_UPDATE_REQUIRED/.test(boundary)],
  ['component boundary avoids claiming saved data was definitely preserved', !/No progress or profile data was removed/.test(boundary)],
  ['route boundary has retry and same-route reload recovery actions', /onClick=\{\(\) => reset\(\)\}/.test(routeError) && /window\.location\.reload\(\)/.test(routeError)],
  ['global boundary has retry and reload recovery actions', /onClick=\{\(\) => reset\(\)\}/.test(globalError) && /window\.location\.reload\(\)/.test(globalError)],
  ['direct upload timeout is communicated as a timeout, not a generic network error', /userMessage: mediaUserMessage\(timedOut \? "MEDIA_REQUEST_TIMEOUT" : "NETWORK"\)/.test(upload)],
  ['timeout message advises checking before repeating an ambiguous upload', /case "MEDIA_REQUEST_TIMEOUT"[\s\S]*?refresh your media list before uploading again/.test(mediaMessages)],
  ['media upload retry remains bounded after Pi session recovery', /return await fetchWithTimeout\(input, \{ \.\.\.init, credentials: "include" \}\)/.test(upload)],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nPhase 7 recovery UX contracts: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Recovery UX contracts failed')
