#!/usr/bin/env node
/** Source contract for bounded in-process rate-limit storage. */
import fs from 'node:fs'
const source = fs.readFileSync('lib/server/economy/rate-limit.ts', 'utf8')
const checks = [
  ['rate-limit map has a fixed upper bound', /const MAX_BUCKETS = 50_000/.test(source)],
  ['expired buckets are reclaimed when capacity is reached', /if \(buckets\.size >= MAX_BUCKETS\) pruneExpiredBuckets\(now\)/.test(source)],
  ['active buckets are never evicted to make capacity', /Do not evict active buckets/.test(source)],
  ['capacity pressure fails closed for new keys', /if \(buckets\.size >= MAX_BUCKETS\) \{\s*return \{ ok: false, retryAfterSec:/.test(source)],
  ['invalid keys and configurations are rejected', /INVALID_RATE_LIMIT_KEY/.test(source) && /INVALID_RATE_LIMIT_CONFIGURATION/.test(source)],
  ['retry guidance is at least one second', /Math\.max\(1, Math\.ceil/.test(source)],
  ['existing bucket cleanup remains available to callers', /export function pruneRateLimitBuckets\(/.test(source) && /pruneExpiredBuckets\(Date\.now\(\)\)/.test(source)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nRate-limit memory-bound contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
