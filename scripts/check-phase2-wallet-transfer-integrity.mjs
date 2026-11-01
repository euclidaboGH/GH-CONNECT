import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const wallet = readFileSync('app/api/economy/wallet/[userId]/route.ts', 'utf8')
const db = readFileSync('lib/server/economy/db.ts', 'utf8')
const transfer = readFileSync('app/api/economy/transfers/[referenceId]/route.ts', 'utf8')
const economyStore = readFileSync('lib/server/economy/store.ts', 'utf8')
const checks = [
  ['wallet transfer-request read fails closed', /if\s*\(!reqs\)\s*\{[\s\S]*?Failed to load transfer requests[\s\S]*?503/.test(wallet)],
  ['wallet failure carries request correlation ID', /Failed to load transfer requests[\s\S]*?requestId:\s*reqCtx\.requestId/.test(wallet)],
  ['transfer request REST query has bounded timeout', /rpcListTransferRequests[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(db)],
  ['transfer reference decode errors become 400', /catch\s*\{\s*return jsonErr\("INVALID_REFERENCE"[\s\S]*?400/.test(transfer)],
  ['transfer reference length is bounded', /referenceId\.length > 128/.test(transfer)],
  ['transfer reference rejects control characters', /\\u0000-\\u001f\\u007f/.test(transfer)],
  ['transfer ownership check remains enforced', /if\s*\(!parties\.includes\(auth\.userId\)\)/.test(transfer)],
  ['financial boundaries reject negative amounts instead of normalizing with abs', !/Math\.abs\(Number\(input\.amount\)\)/.test(economyStore) && (economyStore.match(/const amount = Number\(input\.amount\)/g) || []).length >= 6],
]
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  assert.ok(ok, name)
}
console.log(`PASS ${checks.length}/${checks.length} wallet/transfer integrity checks`)
