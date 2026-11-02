#!/usr/bin/env node
/** Verify the authoritative transfer RPC response is bound to its requested intent. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/server/economy/db.ts', 'utf8')
const mapper = source.slice(source.indexOf('function mapRpcJson('), source.indexOf('/**\n * Call public.ghc_execute_transfer'))
const checks = [
  ['RPC payload must be an object, not an array or primitive', /!data \|\| typeof data !== "object" \|\| Array\.isArray\(data\)/.test(mapper)],
  ['success flag must be explicitly true', /row\.ok !== true/.test(mapper)],
  ['top-level reference must match the requested reference', /String\(row\.referenceId \|\| ""\) !== input\.referenceId/.test(mapper)],
  ['debit identity must match authenticated sender', /validLeg\(debitRaw, input\.senderId, "transfer_out", -input\.amount\)/.test(mapper)],
  ['credit identity must match intended recipient', /validLeg\(creditRaw, input\.toUserId, "transfer_in", input\.amount\)/.test(mapper)],
  ['both legs require posted status and matching reference', /String\(tx\.status \|\| ""\) === "posted"/.test(mapper) && /String\(tx\.referenceId \|\| ""\) === input\.referenceId/.test(mapper)],
  ['transaction IDs are required', /Boolean\(String\(tx\.id \|\| ""\)\.trim\(\)\)/.test(mapper)],
  ['debit and credit must be distinct ledger rows', /String\(debitRaw\.id \|\| ""\)\.trim\(\) === String\(creditRaw\.id \|\| ""\)\.trim\(\)/.test(mapper)],
  ['idempotent is accepted only as a real boolean', /idempotent: row\.idempotent === true/.test(mapper)],
  ['RPC response is validated before normalization', /if \(!Number\.isFinite\(debitAmount\)[\s\S]*?validLeg\(creditRaw[\s\S]*?const norm =/.test(mapper)],
  ['RPC caller passes the original intent into validation', /mapRpcJson\(payload, input\)/.test(source)],
]
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  assert.ok(ok, label)
}
console.log(`PASS ${checks.length}/${checks.length} transfer RPC result-integrity checks`)
