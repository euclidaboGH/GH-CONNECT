#!/usr/bin/env node
/** Phase 2 source contract: authentication must not silently downgrade durable throttling. */
import fs from 'node:fs'
const control = fs.readFileSync('lib/server/security/control-plane.ts', 'utf8')
const auth = fs.readFileSync('app/api/auth/pi/route.ts', 'utf8')
const checks = [
  ['durable limiter exposes explicit unavailable policy', /onUnavailable\?: "local" \| "deny"/.test(control)],
  ['fail-closed mode denies when durable RPC is unavailable', /options\.onUnavailable === "deny"[\s\S]*?return \{ ok: false, retryAfterSec: 5 \}/.test(control)],
  ['local fallback is retained only as an explicit compatibility path', /return localRateLimit\(key, limit, windowMs\)/.test(control)],
  ['Pi authentication opts into fail-closed durable rate limiting', /checkDurableRateLimit\([\s\S]*?onUnavailable: "deny"/.test(auth)],
  ['rate-limit rejection returns retry guidance', /"Retry-After": String\(rate\.retryAfterSec\)/.test(auth)],
  ['security event records blocked auth attempts', /auth\.pi\.rate_limited/.test(auth) && /outcome: "blocked"/.test(auth)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 2 durable rate-limit contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
