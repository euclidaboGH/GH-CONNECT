import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const policy = read('lib/server/economy/withdrawal.ts')
const route = read('app/api/economy/withdrawals/route.ts')
const asset = read('lib/asset-separation.ts')
const docs = read('docs/GH_WITHDRAWAL_PI_SETTLEMENT.md')

assert.match(policy, /process\.env\.GHC_WITHDRAWALS_ENABLED\s*===\s*"true"/, 'withdrawal gate must require explicit true')
assert.equal((route.match(/areGhcPiWithdrawalsEnabled\(\)/g) || []).length, 2, 'GET and POST must both be gated')
assert.match(route, /GHC_WITHDRAWALS_DISABLED/, 'disabled response must have stable error code')
assert.match(route, /status:\s*503/, 'disabled response must fail closed')
assert.match(asset, /conversionEnabled:\s*false\s+as const/, 'cross-asset conversion must remain disabled')
assert.match(docs, /DISABLED BY DEFAULT/, 'operator documentation must state default-off policy')
assert.match(docs, /GHC_WITHDRAWALS_ENABLED=true/, 'documentation must state explicit server-side gate')
console.log('GHC→Pi withdrawal default-off checks: 7 pass, 0 fail')
