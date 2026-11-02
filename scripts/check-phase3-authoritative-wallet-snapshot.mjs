#!/usr/bin/env node
/** Fail closed on stale, incomplete, or cross-account authoritative wallet snapshots. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync('lib/server/economy/db.ts', 'utf8')
const start = source.indexOf('export async function rpcWalletSnapshot(')
const end = source.indexOf('\nexport async function', start + 1)
const fn = source.slice(start, end)
const checks = [
  ['snapshot rejects non-object and array payloads', fn.includes('!data || typeof data !== "object" || Array.isArray(data)')],
  ['all authoritative numeric fields are required including ledgerBalance', fn.includes('data[key] == null || !Number.isFinite(values[key])') && fn.includes('"balance", "ledgerBalance", "locked", "pending"')],
  ['snapshot identity must exactly match the requested account', fn.includes('String(data.userId ?? "") !== userId')],
  ['snapshot timestamp must be present and valid', fn.includes('!Number.isFinite(updatedAt) || updatedAt <= 0') && fn.includes('updatedAt,')],
  ['negative balances and totals are rejected', fn.includes('values.balance < 0 || values.ledgerBalance < 0 || values.locked < 0')],
  ['invalid snapshot returns null rather than a synthetic balance', fn.includes('return null') && !fn.includes('ledgerBalance ? data.balance')],
]
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); assert.ok(ok, label) }
console.log(`PASS ${checks.length}/${checks.length} authoritative wallet snapshot checks`)
