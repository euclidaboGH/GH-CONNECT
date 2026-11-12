#!/usr/bin/env node
/**
 * Phase 42 operator E2E runner.
 * Testnet/Preview only by default. Never invents Pi identity, payment IDs,
 * transaction IDs, wallet balances, or financial outcomes.
 *
 * Required:
 *   GHC_E2E_BASE_URL
 *   GHC_E2E_ALLOW_TESTNET=1
 *   GHC_E2E_COOKIE_A=<real testnet session cookie>
 * Optional:
 *   GHC_E2E_COOKIE_B=<second real testnet session cookie>
 *
 * Pi SDK payment approval/completion still requires a real Pi Browser/Testnet
 * wallet interaction; this runner verifies the server lifecycle around it.
 */
import { requireE2eBaseUrl } from '../lib/e2e/resolve-base-url.mjs'

const resolved = requireE2eBaseUrl(process.env)
if (process.env.GHC_E2E_ALLOW_TESTNET !== '1') {
  console.error('BLOCKED: set GHC_E2E_ALLOW_TESTNET=1 for Phase 42 Testnet execution')
  process.exit(2)
}
if (resolved.isProdTarget || process.env.GHC_E2E_TARGET === 'production') {
  console.error('BLOCKED: Phase 42 runner is Testnet/Preview only; production requires Phase 44 release audit')
  process.exit(2)
}

const base = resolved.baseUrl
const cookieA = String(process.env.GHC_E2E_COOKIE_A || '').trim()
const cookieB = String(process.env.GHC_E2E_COOKIE_B || '').trim()
if (!cookieA) {
  console.error('BLOCKED: GHC_E2E_COOKIE_A must be a real authenticated Testnet/Preview session')
  process.exit(2)
}

let pass = 0, fail = 0, skip = 0
const p = (label, detail='') => { pass++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`) }
const f = (label, detail='') => { fail++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`) }
const s = (label, detail='') => { skip++; console.log(`SKIP ${label}${detail ? ` — ${detail}` : ''}`) }

async function api(cookie, endpoint, init = {}) {
  const res = await fetch(`${base}${endpoint}`, {
    ...init,
    headers: { Accept: 'application/json', Cookie: cookie, ...(init.body ? {'Content-Type':'application/json'} : {}), ...(init.headers || {}) },
    redirect: 'manual',
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text: text.slice(0, 500) }
}

console.log(`\nGREENHAVEN PHASE 42 — PI TESTNET E2E\nBase: ${base}\nTarget: ${resolved.isLocal ? 'local' : 'preview/testnet'}\n`)

const health = await api('', '/api/health')
if ([200,503].includes(health.status)) p('health', `status=${health.status}`)
else f('health', `status=${health.status}`)

const session = await api(cookieA, '/api/auth/session')
if (session.status === 200 && session.json?.authenticated !== false) p('A authenticated session')
else f('A authenticated session', `status=${session.status}`)

const profile = await api(cookieA, '/api/profile/me')
const idA = String(profile.json?.profile?.id || profile.json?.profile?.ghUserId || '')
if (profile.status === 200 && idA) p('A identity resolved')
else f('A identity resolved', `status=${profile.status}`)

for (const [label, endpoint] of [
  ['wallet summary', '/api/economy/wallet/summary'],
  ['membership status', '/api/membership/status'],
  ['creator economy', '/api/social/economy/status'],
  ['notifications', '/api/notifications?limit=10'],
  ['realtime recovery feed', '/api/realtime/events?limit=10'],
  ['marketplace orders', '/api/marketplace/orders?limit=10'],
  ['messaging conversations', '/api/messaging/conversations?limit=10'],
]) {
  const r = await api(cookieA, endpoint)
  if (r.status === 200) p(label)
  else if (r.status === 503) s(label, 'server durability/provider unavailable; infrastructure evidence required')
  else f(label, `status=${r.status}`)
}

// Daily Claim status must not be fabricated by the operator.
const daily = await api(cookieA, '/api/economy/rewards/daily')
if ([200,409,429,503].includes(daily.status)) p('Daily Claim endpoint reachable', `status=${daily.status}`)
else f('Daily Claim endpoint reachable', `status=${daily.status}`)

if (cookieB) {
  const profileB = await api(cookieB, '/api/profile/me')
  const idB = String(profileB.json?.profile?.id || profileB.json?.profile?.ghUserId || '')
  if (profileB.status === 200 && idB && idB !== idA) p('A/B distinct identities')
  else f('A/B distinct identities', `A=${idA || '?'} B=${idB || '?'}`)
} else {
  s('two-user isolation', 'set GHC_E2E_COOKIE_B for a second real Testnet account')
}

console.log(`\nSummary: passed=${pass} failed=${fail} skipped=${skip}`)
if (fail) process.exit(1)
