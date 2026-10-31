import fs from 'node:fs'
import assert from 'node:assert/strict'
const fund = fs.readFileSync('app/api/admin/creator-rewards/fund/route.ts', 'utf8')
const settle = fs.readFileSync('app/api/admin/creator-rewards/settle/route.ts', 'utf8')
const env = fs.readFileSync('.env.example', 'utf8')
const checks = [
  ['fund endpoint uses streaming bounded JSON parser', () => assert.match(fund, /readBoundedJson\(request,\s*4_096\)/)],
  ['fund endpoint maps oversized body to 413', () => assert.match(fund, /parsed\.error === "REQUEST_TOO_LARGE" \? 413 : 400/)],
  ['fund operator secret requires at least 32 bytes', () => assert.match(fund, /expected\.length >= 32/)],
  ['settlement operator secret requires at least 32 bytes', () => assert.match(settle, /expected\.length >= 32/)],
  ['fund RPC has an upstream timeout', () => assert.match(fund, /AbortSignal\.timeout\(15_000\)/)],
  ['fund and settle use timing-safe comparison', () => { assert.match(fund, /timingSafeEqual/); assert.match(settle, /timingSafeEqual/) }],
  ['operator secret documented as server-only', () => assert.match(env, /GHC_CREATOR_REWARD_OPERATOR_KEY=.*server-side|GHC_CREATOR_REWARD_OPERATOR_KEY=/)],
]
let failures = 0
for (const [name, fn] of checks) { try { fn(); console.log(`PASS ${name}`) } catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`) } }
console.log(`${checks.length - failures}/${checks.length} checks passed`)
if (failures) process.exitCode = 1
