#!/usr/bin/env node
/** Ensures privileged economy RPCs are deadline-bounded and identity-bound. Source-only; no DB access. */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(join(root, 'lib/server/economy/db.ts'), 'utf8')
const checks = [
  ['account creation RPC is deadline-bounded', /rpcEnsureAccountCreatedAt[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['pending reward staging RPC is deadline-bounded', /rpcStagePending[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['activity reward staging RPC is deadline-bounded', /rpcActivityStageReward[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['pending reward claim RPC is deadline-bounded', /rpcClaimPending[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['economic population stats RPC is deadline-bounded', /rpcEconomicPopulationStats[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['claim streak read RPC is deadline-bounded', /rpcGetClaimStreak[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['claim streak read rejects mismatched identity', /rpcGetClaimStreak[\s\S]*?String\(data\.userId\) !== userId/.test(source)],
  ['claim-day commit RPC is deadline-bounded', /rpcCommitClaimDay[\s\S]*?signal:\s*AbortSignal\.timeout\(12_000\)/.test(source)],
  ['atomic daily claim RPC is deadline-bounded', /rpcExecuteDailyClaimV12[\s\S]*?signal:\s*AbortSignal\.timeout\(12_000\)/.test(source)],
  ['orphan transfer listing RPC is deadline-bounded', /listOrphanTransferOuts[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
  ['orphan transfer completion RPC is deadline-bounded', /completeOrphanTransferIn[\s\S]*?signal:\s*AbortSignal\.timeout\(8_000\)/.test(source)],
]
const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
console.log(`Result: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
