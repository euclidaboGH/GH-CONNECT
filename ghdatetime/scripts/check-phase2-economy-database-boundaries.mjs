#!/usr/bin/env node
/** Source-contract checks for bounded and fail-closed economy database reads. */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(join(root, 'lib/server/economy/db.ts'), 'utf8')
const checks = [
  ['transaction history has an 8-second deadline', /rpcListTransactions[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['transaction history rejects malformed rows instead of mapping them', /rows\.some\(\(r\) =>[\s\S]*?Number\.isFinite\(Number\(r\.amount\)\)[\s\S]*?String\(r\.user_id \|\| ""\) !== userId/.test(source)],
  ['wallet snapshot validates the requested identity', /rpcWalletSnapshot[\s\S]*?!userId\?\.trim\(\)[\s\S]*?userId\.length > 160/.test(source)],
  ['wallet snapshot rejects non-finite and negative totals', /numeric\.some\(\(key\) => !Number\.isFinite\(values\[key\]\)\)[\s\S]*?values\.balance < 0[\s\S]*?values\.ledgerBalance < 0/.test(source)],
  ['wallet snapshot rejects a mismatched returned user', /String\(data\.userId\) !== userId/.test(source)],
  ['transfer-reference lookup validates its reference', /rpcFindTransferByReference[\s\S]*?!referenceId\?\.trim\(\)[\s\S]*?referenceId\.length > 160/.test(source)],
  ['transfer-reference query has a hard result cap', /kind=in\.\(transfer_out,transfer_in\)&limit=3/.test(source)],
  ['transfer-reference query has an 8-second deadline', /rpcFindTransferByReference[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['transfer-reference lookup rejects duplicate ledger sides', /debit\.length > 1 \|\| credit\.length > 1/.test(source)],
  ['transfer-request RPC calls have an 8-second deadline', /async function rpcJson[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
]
const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
console.log(`Result: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
