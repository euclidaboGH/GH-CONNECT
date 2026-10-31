#!/usr/bin/env node
/** Phase 2 source contract: privileged system diagnostics are operator-only and read-only. */
import fs from 'node:fs'
const route = fs.readFileSync('app/api/system/status/route.ts', 'utf8')
const checks = [
  ['system status requires a dedicated operator secret', /GH_SYSTEM_STATUS_OPERATOR_KEY/.test(route) && /x-gh-system-status-key/.test(route)],
  ['operator secret requires high entropy length', /expected\.length >= 32/.test(route)],
  ['secret comparison is timing safe', /timingSafeEqual\(supplied, expected\)/.test(route)],
  ['unauthorized requests stop before diagnostic work', /if \(!authorized\(request\)\) return reply\(\{ ok: false, error: "FORBIDDEN" \}, 403\)/.test(route)],
  ['status endpoint does not provision buckets', !/ensureMediaBucket/.test(route)],
  ['status endpoint does not invoke privileged RPCs', !/\/rest\/v1\/rpc\//.test(route) && !/method: "POST"/.test(route)],
  ['database probes are read-only and bounded by timeout', /method: "GET"/.test(route) && /AbortSignal\.timeout\(5_000\)/.test(route)],
  ['provider exception details are not reflected', /catch \{\s*\/\/ Avoid reflecting exception messages/.test(route) && !/message: e instanceof Error/.test(route)],
  ['diagnostics are not cacheable', /Cache-Control.*private, no-store/.test(route)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 2 operator-only status contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
