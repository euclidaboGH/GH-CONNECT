#!/usr/bin/env node
/** Read-only/negative-path deployed smoke. Never sends valid payment or economic mutations. */
import { requireE2eBaseUrl } from '../lib/e2e/resolve-base-url.mjs'
const resolved = requireE2eBaseUrl(process.env)
const base = resolved.baseUrl
let passed = 0, failed = 0, skipped = 0
const pass = (m) => { passed++; console.log(`PASS ${m}`) }
const fail = (m) => { failed++; console.error(`FAIL ${m}`) }
const skip = (m) => { skipped++; console.log(`SKIP ${m}`) }
async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, redirect: 'manual', headers: { Accept: 'application/json', ...(init.headers || {}) } })
  const body = await response.text()
  let json = null
  try { json = JSON.parse(body) } catch {}
  return { status: response.status, json, text: body.slice(0, 180), cache: response.headers.get('cache-control') }
}
console.log(`GH Connect Phase 7 runtime hardening\nBase: ${base}\nTarget: ${resolved.isLocal ? 'local' : resolved.isProdTarget ? 'production' : 'preview/other'}\nNo valid economic mutations will be sent.\n`)
const probes = [
  ['unauthenticated reward claim is rejected', '/api/economy/rewards/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ holdId: 'phase7-negative-probe' }) }, [401]],
  ['unauthenticated payment fulfillment is rejected', '/api/payments/fulfill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: 'phase7-negative-probe' }) }, [401]],
  ['unauthenticated referral attribution is rejected', '/api/referral/attribute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'phase7-probe' }) }, [401]],
  ['unauthenticated messaging read is rejected', '/api/messaging/conversations/phase7-probe/messages', { method: 'GET' }, [401]],
  ['invalid Paystack signature is rejected', '/api/webhooks/paystack', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paystack-signature': '0'.repeat(128) }, body: JSON.stringify({ event: 'transfer.success', data: {} }) }, [401]],
]
try {
  const r = await request('/api/health')
  if ([200, 503].includes(r.status)) pass(`health endpoint reachable (${r.status}; status=${r.json?.status || 'unknown'})`)
  else fail(`health endpoint unexpected HTTP ${r.status}`)
} catch (e) { fail(`health endpoint request failed: ${e instanceof Error ? e.message : 'network error'}`) }
for (const [label, path, init, allowed] of probes) {
  try {
    const r = await request(path, init)
    if (allowed.includes(r.status)) pass(`${label} (HTTP ${r.status})`)
    else fail(`${label}: expected ${allowed.join('/')} but got ${r.status}`)
  } catch (e) { fail(`${label}: ${e instanceof Error ? e.message : 'network error'}`) }
}
const a = process.env.GHC_E2E_COOKIE_A || process.env.GHC_E2E_AUTH_A
const b = process.env.GHC_E2E_COOKIE_B || process.env.GHC_E2E_AUTH_B
if (a && b) skip('Credentials detected, but this negative-path script intentionally does not mutate or message between users; run operator-live-e2e for the existing two-user probes')
else skip('Two-user authorization needs GHC_E2E_COOKIE_A/B or GHC_E2E_AUTH_A/B and is not asserted here')
console.log(`\nPhase 7 runtime smoke: ${passed} passed, ${failed} failed, ${skipped} skipped`)
if (failed) process.exit(1)
