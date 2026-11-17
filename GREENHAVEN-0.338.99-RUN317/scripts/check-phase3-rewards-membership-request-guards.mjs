#!/usr/bin/env node
/** Phase 3 guard: authenticated reward/membership reads and purchase/recovery paths are durably rate limited. */
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const files = {
  status: read('app/api/membership/status/route.ts'),
  lifecycle: read('app/api/membership/lifecycle/route.ts'),
  reconcile: read('app/api/membership/reconcile/route.ts'),
  activate: read('app/api/membership/activate/route.ts'),
}
const checks = [
  ['membership status imports durable fail-closed rate limiter', files.status.includes('checkDurableRateLimit') && files.status.includes('onUnavailable: "deny"')],
  ['membership status limits authenticated identity before entitlement reconciliation', files.status.indexOf('membership-status:${auth.userId}') > files.status.indexOf('if (!auth)') && files.status.indexOf('membership-status:${auth.userId}') < files.status.indexOf('const result = await tryGetEntitlementAuthoritative')],
  ['membership lifecycle history is rate limited per authenticated account', files.lifecycle.includes('membership-lifecycle:${auth.userId}') && files.lifecycle.includes('onUnavailable: "deny"')],
  ['membership reconciliation is rate limited before payment-intent history scan', files.reconcile.indexOf('membership-reconcile:${auth.userId}') > files.reconcile.indexOf('if (!auth)') && files.reconcile.indexOf('membership-reconcile:${auth.userId}') < files.reconcile.indexOf('const result = await reconcileMembershipFromPaymentHistory')],
  ['membership purchase activation is rate limited before parsing/spending', files.activate.indexOf('membership-activate:${auth.userId}') > files.activate.indexOf('if (!auth)') && files.activate.indexOf('membership-activate:${auth.userId}') < files.activate.indexOf('const boundedBody = await readBoundedJson')],
  ['rate-limit responses are non-cacheable on sensitive membership routes', ['status','lifecycle','reconcile','activate'].every((key) => files[key].includes('Cache-Control') && files[key].includes('no-store'))],
  ['membership routes expose provider-neutral rate-limit error codes', ['status','lifecycle','reconcile','activate'].every((key) => files[key].includes('durableRateLimitCode') && files[key].includes('durableRateLimitStatus'))],
  ['purchase limiter has a tighter threshold than read-only status/history', files.activate.includes('membership-activate:${auth.userId}`, 8, 60_000') && files.status.includes('membership-status:${auth.userId}`, 60, 60_000')],
  ['reconciliation limiter is tighter than status/history reads', files.reconcile.includes('membership-reconcile:${auth.userId}`, 10, 60_000') && files.lifecycle.includes('membership-lifecycle:${auth.userId}`, 60, 60_000')],
  ['no client-supplied user ID is used as limiter identity', Object.values(files).every((source) => !/membership-(?:status|lifecycle|reconcile|activate):\$\{(?:body|raw|parsed\.data)\.userId/.test(source))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`Phase 3 rewards/membership request guard: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
