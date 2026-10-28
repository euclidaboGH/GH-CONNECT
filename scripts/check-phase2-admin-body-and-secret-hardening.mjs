import fs from 'node:fs'
import assert from 'node:assert/strict'
const settle = fs.readFileSync('app/api/admin/creator-rewards/settle/route.ts', 'utf8')
const fund = fs.readFileSync('app/api/admin/creator-rewards/fund/route.ts', 'utf8')
const revenue = fs.readFileSync('app/api/admin/revenue-summary/route.ts', 'utf8')
const checks = [
  ['settlement uses streaming bounded JSON reader', () => assert.match(settle, /readBoundedJson\(request,\s*MAX_SETTLEMENT_BODY_BYTES\)/)],
  ['settlement enforces size before JSON parsing', () => assert.ok(settle.indexOf('readBoundedJson(request') < settle.indexOf('const rewardEventId ='))],
  ['settlement oversized payload maps to 413', () => assert.match(settle, /parsed\.error === "REQUEST_TOO_LARGE" \? 413 : 400/)],
  ['settlement has no unbounded request.text read', () => assert.doesNotMatch(settle, /request\.text\(\)/)],
  ['settlement has a finite upstream timeout', () => assert.match(settle, /AbortSignal\.timeout\(15_000\)/)],
  ['funding and settlement both enforce 32-byte operator secret', () => { assert.match(fund, /expected\.length >= 32/); assert.match(settle, /expected\.length >= 32/) }],
  ['revenue summary rejects short admin secrets', () => assert.match(revenue, /Buffer\.byteLength\(expectedRaw, "utf8"\) < 32/)],
  ['admin summary retains timing-safe secret comparison', () => assert.match(revenue, /timingSafeEqual\(expected, supplied\)/)],
]
let failures = 0
for (const [name, fn] of checks) { try { fn(); console.log(`PASS ${name}`) } catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`) } }
console.log(`${checks.length - failures}/${checks.length} checks passed`)
if (failures) process.exitCode = 1
