#!/usr/bin/env node
/** Phase 10: operator diagnostics must fail closed on provider probe failures. */
import fs from 'node:fs'
const route = fs.readFileSync('app/api/system/status/route.ts', 'utf8')
const checks = [
  ['system diagnostics remain operator-only', /if \(!authorized\(request\)\) return reply\(\{ ok: false, error: "FORBIDDEN" \}, 403\)/.test(route)],
  ['provider probes are GET-only', /method: "GET"/.test(route) && !/method: "POST"/.test(route)],
  ['independent table probes run concurrently', /await Promise\.all\(targets\.map\(async/.test(route)],
  ['each probe has a bounded timeout', /AbortSignal\.timeout\(5_000\)/.test(route)],
  ['HTTP 404 is distinguished as a missing table', /response\.status === 404\) probes\[label\] = "MISSING"/.test(route)],
  ['HTTP 401 and 403 are distinguished as rejected credentials', /response\.status === 401 \|\| response\.status === 403\) probes\[label\] = "AUTH_REJECTED"/.test(route)],
  ['upstream 5xx responses are distinguished', /response\.status >= 500\) probes\[label\] = "UPSTREAM_ERROR"/.test(route)],
  ['network failures are represented without exception details', /catch \{\s*probes\[label\] = "UNREACHABLE"/.test(route)],
  ['rejected credentials produce a readiness blocker', /probeValues\.includes\("AUTH_REJECTED"\).*SUPABASE_CREDENTIALS_REJECTED/.test(route)],
  ['unreachable provider produces a readiness blocker', /probeValues\.includes\("UNREACHABLE"\).*SUPABASE_PROBE_UNREACHABLE/.test(route)],
  ['upstream and unexpected HTTP failures produce a blocker', /SUPABASE_PROBE_FAILED/.test(route)],
  ['responses remain non-cacheable', /"Cache-Control": "private, no-store, max-age=0"/.test(route)],
  ['exception details are not reflected to callers', /catch \{\s*\/\/ Avoid reflecting exception messages/.test(route) && !/message: e instanceof Error/.test(route)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 10 system-status probe checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
