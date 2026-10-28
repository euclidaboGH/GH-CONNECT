import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const cases = [
  ['transfer request creation', 'app/api/economy/transfer-requests/route.ts', 8 * 1024],
  ['GHC pack purchase', 'app/api/economy/purchase-ghc/route.ts', 8 * 1024],
  ['ledger spend', 'app/api/economy/ledger/spend/route.ts', 8 * 1024],
  ['utility purchase', 'app/api/economy/utility/route.ts', 8 * 1024],
  ['daily reward claim', 'app/api/economy/rewards/daily/route.ts', 4 * 1024],
]
let passed = 0
for (const [label, file, limit] of cases) {
  const source = readFileSync(file, 'utf8')
  const checks = [
    ['uses shared streaming JSON parser', source.includes('readBoundedJson(request, ' + limit + ')')],
    ['does not call unbounded request.json()', !source.includes('request.json()')],
    ['oversized bodies map to HTTP 413', source.includes('parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400')],
    ['parse failures return stable client error', source.includes('parsedBody.error === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE"')],
  ]
  for (const [detail, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${detail}`)
    assert.ok(ok, `${label}: ${detail}`)
    passed++
  }
}
console.log(`PASS ${passed}/${cases.length * 4} financial request-boundary checks`)
