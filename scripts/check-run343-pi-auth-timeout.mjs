#!/usr/bin/env node
/** RUN343: prevent Pi.authenticate from leaving the sign-in retry path locked forever. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const runtime = readFileSync(new URL('../lib/pi-runtime.ts', import.meta.url), 'utf8')
const context = readFileSync(new URL('../contexts/pi-auth-context.tsx', import.meta.url), 'utf8')
const checks = [
  ['official Pi auth has a finite prompt timeout', /const authTimeoutMs = 25000/.test(runtime)],
  ['timeout emits a token-free stage diagnostic', /PI_AUTH_PROMPT_TIMEOUT/.test(runtime) && /stage: "pi_authenticate"/.test(runtime)],
  ['timeout rejects with a user-actionable retry message', /Pi authorization prompt timed out\. Return to Pi Browser and tap Retry Pi authentication\./.test(runtime)],
  ['timeout is always cleared after resolve or rejection', /finally \{\s*if \(authTimeout !== undefined\) clearTimeout\(authTimeout\)/.test(runtime)],
  ['server-side identity verification remains mandatory', /caller must POST accessToken to \/api\/auth\/pi for verification/.test(runtime)],
  ['timeout does not introduce local identity fallback', !/PI_AUTH_PROMPT_TIMEOUT[\s\S]{0,500}continueLocalPreview/.test(runtime)],
  ['manual Retry is queued instead of silently ignored during an in-flight attempt', /retryRequestedRef = useRef\(false\)/.test(context) && /if \(authAttemptRef\.current\) \{\s*retryRequestedRef\.current = true/.test(context)],
  ['queued Retry starts only after the active attempt releases its single-flight guard', /authAttemptRef\.current = false;\s*if \(retryRequestedRef\.current\)/.test(context) && /window\.setTimeout\(\(\) => \{ void initialize\(\); \}, 0\)/.test(context)],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}
console.log(`\nRUN343 Pi auth timeout regression: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
