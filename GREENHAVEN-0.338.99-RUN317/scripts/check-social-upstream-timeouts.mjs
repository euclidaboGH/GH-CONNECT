import fs from 'node:fs'
import assert from 'node:assert/strict'

const source = fs.readFileSync('lib/server/social/rpc.ts', 'utf8')
const transport = fs.readFileSync('lib/server/supabase/rest-client.ts', 'utf8')
const checks = [
  ['shared upstream timeout is finite', /const SOCIAL_UPSTREAM_TIMEOUT_MS = 12_000/.test(source)],
  ['RPC transport receives the shared timeout budget', /supabaseRpc\(fn, body, \{ timeoutMs: SOCIAL_UPSTREAM_TIMEOUT_MS \}\)/.test(source)],
  ['REST transport receives the shared timeout budget', /timeoutMs: SOCIAL_UPSTREAM_TIMEOUT_MS/.test(source)],
  ['central Supabase transport enforces AbortSignal timeout', /signal: fetchInit\.signal \?\? AbortSignal\.timeout\(timeoutMs \?\? 15_000\)/.test(transport) && /signal: AbortSignal\.timeout\(options\.timeoutMs \?\? 15_000\)/.test(transport)],
  ['RPC timeout has stable error code', /error: timedOut \? "RPC_TIMEOUT" : "RPC_NETWORK"/.test(source)],
  ['REST timeout has stable error code', /error: timedOut \? "REST_TIMEOUT" : "REST_NETWORK"/.test(source)],
  ['service role authorization remains centralized server-side', /h\.set\("Authorization", `Bearer \$\{key\}`\)/.test(transport) && /getServiceSupabaseConfig/.test(transport)],
  ['requests remain uncached in the central transport', /cache: "no-store"/.test(transport)],
  ['response body is not included in timeout errors', !/error: e instanceof Error \? e\.message/.test(source)],
]
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
  assert.ok(pass, name)
}
console.log(`\n${checks.length}/${checks.length} social upstream timeout checks passed`)
