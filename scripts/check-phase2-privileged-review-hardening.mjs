#!/usr/bin/env node
/** Phase 2 source contracts for privileged verification review and governance mirrors. */
import fs from 'node:fs'
const review = fs.readFileSync('app/api/verification/review/route.ts', 'utf8')
const reports = fs.readFileSync('app/api/governance/reports/route.ts', 'utf8')
const log = fs.readFileSync('app/api/governance/moderation-log/route.ts', 'utf8')
const checks = [
  ['verification review uses dedicated secret, not service-role fallback', /VERIFICATION_REVIEW_SECRET/.test(review) && !/VERIFICATION_REVIEW_SECRET\s*\|\|\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(review)],
  ['verification review secret enforces 32-byte minimum', /Buffer\.byteLength\(serviceKey, "utf8"\) < 32/.test(review)],
  ['verification review uses timing-safe comparison', /timingSafeEqual\(a, b\)/.test(review)],
  ['verification review body is stream-bounded', /readBoundedJson\(req, 8 \* 1024\)/.test(review)],
  ['verification reviewer identity is not accepted from caller', /const reviewerId = "authorized-operator"/.test(review) && !/body\??\.reviewerId/.test(review)],
  ['verification review does not return storage exception detail', !/message: updated\.error/.test(review)],
  ['verification queue responses are non-cacheable', /Cache-Control.*private, no-store/.test(review)],
  ['governance report body is stream-bounded', /readBoundedJson\(req, 12 \* 1024\)/.test(reports)],
  ['moderation log body is stream-bounded', /readBoundedJson\(req, 12 \* 1024\)/.test(log)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 2 privileged review hardening: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
