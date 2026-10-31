#!/usr/bin/env node
/** Ensure uncertain transfer outcomes are reported as retryable service failures. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const route = readFileSync('app/api/economy/transfers/route.ts', 'utf8')
const db = readFileSync('lib/server/economy/db.ts', 'utf8')
const checks = [
  ['RPC timeout is classified as NETWORK_TIMEOUT', /timedOut \? "NETWORK_TIMEOUT"/.test(db)],
  ['timeout error message instructs reconciliation', /Reconcile this transfer before retrying/.test(readFileSync('lib/domains/economy-transfer-contract.ts', 'utf8'))],
  ['NETWORK_TIMEOUT maps to HTTP 503, not client validation failure', /result\.error\.code === "SERVER_UNAVAILABLE" \|\| result\.error\.code === "NETWORK_TIMEOUT"\s*\? 503\s*:\s*400/.test(route)],
  ['timeout path does not automatically issue another transfer', !/NETWORK_TIMEOUT[\s\S]{0,250}rpcExecuteTransfer\(/.test(route)],
]
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); assert.ok(ok, name) }
console.log(`PASS ${checks.length}/${checks.length} transfer timeout response checks`)
