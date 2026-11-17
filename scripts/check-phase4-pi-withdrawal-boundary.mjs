#!/usr/bin/env node
/** Phase 4: bounded PI withdrawal quote input and cancellation-safe quote UX. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const route = readFileSync('app/api/economy/earnings/quote/route.ts', 'utf8')
const dashboard = readFileSync('components/ghc/unified-earnings-dashboard.tsx', 'utf8')
const cashback = readFileSync('app/api/economy/rewards/pi-cashback/claim/route.ts', 'utf8')
const checks = [
  ['quote endpoint uses bounded streaming JSON', route.includes('readBoundedJson(request, 8 * 1024)')],
  ['quote endpoint rejects oversized bodies with HTTP 413', route.includes('parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400')],
  ['quote endpoint does not use unbounded request.json()', !route.includes('request.json()')],
  ['atomic quote input requires a safe integer', route.includes('Number.isSafeInteger(body.amountAtomic)')],
  ['PI decimal input must be finite and positive', route.includes('Number.isFinite(body.amountPi)') && route.includes('body.amountPi > 0')],
  ['converted atomic amount must remain safe', route.includes('Number.isSafeInteger(grossAtomic)')],
  ['quote UI uses no-store fetch semantics', dashboard.includes('cache: "no-store"')],
  ['quote UI has a 10-second timeout', dashboard.includes('setTimeout(() => controller.abort(), 10_000)')],
  ['quote UI aborts superseded requests', dashboard.includes('quoteController.current?.abort()')],
  ['stale quote responses cannot overwrite current state', dashboard.includes('sequence !== quoteSequence.current')],
  ['component cleanup aborts in-flight quote', dashboard.includes('quoteController.current?.abort()') && dashboard.includes('quoteSequence.current += 1')],
  ['general earnings quote is not implemented through cashback-only route', route.includes('quoteWithdrawal') && !route.includes('/rewards/pi-cashback') && cashback.includes('gh_pi_cashback_a2u_begin')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nPhase 4 PI withdrawal boundary: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Phase 4 PI withdrawal boundary checks failed')
