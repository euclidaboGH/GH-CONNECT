import fs from 'node:fs'
import assert from 'node:assert/strict'

const source = fs.readFileSync('lib/server/social/rpc.ts', 'utf8')
const checks = [
  ['shared upstream timeout is finite', /const SOCIAL_UPSTREAM_TIMEOUT_MS = 12_000/.test(source)],
  ['RPC fetch uses timeout signal', /signal: AbortSignal\.timeout\(SOCIAL_UPSTREAM_TIMEOUT_MS\)/.test(source)],
  ['direct REST fetch uses timeout signal', (source.match(/signal: AbortSignal\.timeout\(SOCIAL_UPSTREAM_TIMEOUT_MS\)/g) || []).length === 2],
  ['RPC timeout has stable error code', /error: timedOut \? "RPC_TIMEOUT" : "RPC_NETWORK"/.test(source)],
  ['REST timeout has stable error code', /error: timedOut \? "REST_TIMEOUT" : "REST_NETWORK"/.test(source)],
  ['service role authorization remains server-side', /Authorization: `Bearer \$\{env\.supabaseServiceRoleKey\}`/.test(source)],
  ['requests remain uncached', (source.match(/cache: "no-store"/g) || []).length >= 2],
  ['response body is not included in timeout errors', !/error: e instanceof Error \? e\.message/.test(source)],
]
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
  assert.ok(pass, name)
}
console.log(`\n${checks.length}/${checks.length} social upstream timeout checks passed`)
