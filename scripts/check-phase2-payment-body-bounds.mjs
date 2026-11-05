import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const cases = [
  ['Pi payment approval', 'app/api/payments/approve/route.ts'],
  ['Pi payment completion', 'app/api/payments/complete/route.ts'],
  ['payment fulfillment', 'app/api/payments/fulfill/route.ts'],
  ['incomplete-payment recovery', 'app/api/payments/incomplete/route.ts'],
  ['GH Pay order creation', 'app/api/payments/orders/route.ts'],
]
let passed = 0
for (const [label, file] of cases) {
  const source = readFileSync(file, 'utf8')
  const checks = [
    ['uses shared 8 KiB streaming JSON parser', source.includes('readBoundedJson(request, 8 * 1024)')],
    ['does not call unbounded request.json()', !source.includes('request.json()')],
    ['oversized bodies return HTTP 413', source.includes('status: tooLarge ? 413 : 400')],
    ['parse failures are non-cacheable', source.includes('"Cache-Control": "no-store"')],
  ]
  for (const [detail, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${detail}`)
    assert.ok(ok, `${label}: ${detail}`)
    passed++
  }
}
console.log(`PASS ${passed}/${cases.length * 4} payment request-boundary checks`)
