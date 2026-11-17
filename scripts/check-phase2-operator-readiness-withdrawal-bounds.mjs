import fs from 'node:fs'
import assert from 'node:assert/strict'

const claim = fs.readFileSync('app/api/operator/claim-readiness-report/route.ts', 'utf8')
const readiness = fs.readFileSync('app/api/operator/pi-listing-readiness/route.ts', 'utf8')
const withdrawal = fs.readFileSync('app/api/economy/withdrawals/operator/route.ts', 'utf8')
const checks = [
  ['claim readiness requires operator authorization', /if \(!operatorAuthorized\(request\)\)/.test(claim)],
  ['claim readiness rejects missing or weak admin secrets', /byteLength\(expectedRaw, "utf8"\) < 32/.test(claim)],
  ['claim readiness compares fixed-size digests timing-safely', /timingSafeEqual\(expected, supplied\)/.test(claim)],
  ['Pi listing readiness requires operator authorization', /if \(!operatorAuthorized\(request\)\)/.test(readiness)],
  ['Pi listing readiness rejects missing or weak admin secrets', /byteLength\(expectedRaw, "utf8"\) < 32/.test(readiness)],
  ['withdrawal operator uses streaming bounded JSON', /readBoundedJson\(request, 4 \* 1024\)/.test(withdrawal)],
  ['withdrawal operator returns 413 for oversized payloads', /REQUEST_TOO_LARGE/.test(withdrawal) && /\? 413 : 400/.test(withdrawal)],
  ['withdrawal identifiers and metadata are bounded', /\{8,180\}/.test(withdrawal) && /rejectReason\.length > 500/.test(withdrawal)],
  ['withdrawal metadata rejects control characters', /\\u0000-\\u001f/.test(withdrawal)],
]
for (const [name, ok] of checks) {
  assert.ok(ok, name)
  console.log(`PASS ${name}`)
}
console.log(`${checks.length}/${checks.length} Phase 2 operator boundary checks passed`)
