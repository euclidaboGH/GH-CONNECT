#!/usr/bin/env node
/** Regression guard for the privileged transfer RPC boundary. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib/server/economy/db.ts'), 'utf8')
const transfer = source.slice(source.indexOf('export async function rpcExecuteTransfer('), source.indexOf('export async function rpcListTransactions('))
const checks = [
  ['RPC validates sender and recipient before privileged fetch', transfer.includes('!input.senderId?.trim()') && transfer.includes('!input.toUserId?.trim()')],
  ['RPC rejects self transfers', transfer.includes('input.senderId === input.toUserId')],
  ['RPC rejects non-finite and non-positive amounts', transfer.includes('!Number.isFinite(input.amount)') && transfer.includes('input.amount <= 0')],
  ['RPC bounds and sanitizes idempotency reference', transfer.includes('input.referenceId.length > 160') && transfer.includes('INVALID_TRANSFER_INPUT')],
  ['RPC bounds note and request ID', transfer.includes('input.note.length > 500') && transfer.includes('input.requestId.length > 160')],
  ['authoritative RPC has a finite timeout', transfer.includes('signal: AbortSignal.timeout(12_000)')],
  ['HTTP error body is not read or exposed', !transfer.includes('await res.text()') && transfer.includes('HTTP error bodies may contain SQL')],
  ['timeout maps to reconciliation-safe NETWORK_TIMEOUT', transfer.includes('timedOut ? "NETWORK_TIMEOUT"')],
  ['RPC retains stable generic server errors', transfer.includes('mapTransferFailure("SERVER_UNAVAILABLE", "SERVER_UNAVAILABLE")')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nTransfer RPC boundary checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
