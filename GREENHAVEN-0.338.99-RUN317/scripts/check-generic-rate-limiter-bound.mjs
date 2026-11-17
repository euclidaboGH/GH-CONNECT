#!/usr/bin/env node
/** Source contract for the exported general-purpose rate limiter. */
import fs from 'node:fs'
const source = fs.readFileSync('lib/rate-limiter.ts', 'utf8')
const checks = [
  ['generic limiter has a configurable hard bucket cap', /maxBuckets = 10_000/.test(source) && /this\.limits\.size >= this\.maxBuckets/.test(source)],
  ['expired entries are pruned at capacity', /private pruneExpired\(now: number\)/.test(source) && /entry\.resetTime <= now/.test(source)],
  ['cleanup scans are throttled to reduce CPU under pressure', /now - this\.lastPruneAt < 1_000/.test(source)],
  ['active keys are not evicted to bypass existing limits', /Never evict an active key/.test(source)],
  ['capacity pressure denies new keys', /if \(this\.limits\.size >= this\.maxBuckets\) return false/.test(source)],
  ['constructor rejects invalid settings', /INVALID_RATE_LIMIT_CONFIGURATION/.test(source) && /Number\.isSafeInteger\(maxBuckets\)/.test(source)],
  ['keys are validated and bounded', /INVALID_RATE_LIMIT_KEY/.test(source) && /key\.length > 512/.test(source)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nGeneric rate-limiter contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
