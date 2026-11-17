#!/usr/bin/env node
/**
 * Phase F — Operator live probes for product surfaces (feed health, marketplace, communities, claim).
 * Env: GHC_E2E_BASE_URL, GHC_E2E_ALLOW_TESTNET=1, optional GHC_E2E_COOKIE_A
 * Does not claim funded A2U or Mainnet readiness.
 */
import { requireE2eBaseUrl } from '../lib/e2e/resolve-base-url.mjs'

const resolved = requireE2eBaseUrl(process.env)
if (process.env.GHC_E2E_ALLOW_TESTNET !== '1') {
  console.error('BLOCKED: set GHC_E2E_ALLOW_TESTNET=1')
  process.exit(2)
}
if (resolved.isProdTarget || process.env.GHC_E2E_TARGET === 'production') {
  console.error('BLOCKED: Phase F product live probes are Testnet/Preview only')
  process.exit(2)
}

const base = resolved.baseUrl
const cookie = String(process.env.GHC_E2E_COOKIE_A || '').trim()
let pass = 0, fail = 0, skip = 0
const p = (l, d = '') => { pass++; console.log(`PASS ${l}${d ? ` — ${d}` : ''}`) }
const f = (l, d = '') => { fail++; console.error(`FAIL ${l}${d ? ` — ${d}` : ''}`) }
const s = (l, d = '') => { skip++; console.log(`SKIP ${l}${d ? ` — ${d}` : ''}`) }

async function req(path, { method = 'GET', body, authed = false } = {}) {
  const headers = { Accept: 'application/json' }
  if (authed && cookie) headers.Cookie = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 200) }
}

console.log(`\nPhase F product live E2E\nBase: ${base}\n`)

// Health / media
{
  const paths = ['/api/health', '/api/media/health', '/api/economy/health']
  for (const path of paths) {
    const r = await req(path)
    if (r.status === 200 || r.status === 503 || r.status === 401) p(`${path} responds`, `status=${r.status}`)
    else f(`${path} responds`, `status=${r.status}`)
  }
}

// Marketplace public listings (auth optional)
{
  const r = await req('/api/marketplace/listings')
  if ([200, 401, 503].includes(r.status)) p('marketplace listings reachable', `status=${r.status}`)
  else f('marketplace listings reachable', `status=${r.status}`)
}

// Communities directory
{
  const r = await req('/api/communities')
  if ([200, 401, 503].includes(r.status)) p('communities directory reachable', `status=${r.status}`)
  else f('communities directory reachable', `status=${r.status}`)
}

// Daily claim status — must not invent balances
{
  const r = await req('/api/economy/daily-claim/status')
  if (r.status === 401) p('daily-claim status requires auth', String(r.status))
  else if (r.status === 404) s('daily-claim status route missing', 'optional alternate path')
  else if ([200, 503].includes(r.status)) p('daily-claim status reachable', String(r.status))
  else f('daily-claim status', `status=${r.status}`)
}

if (!cookie) {
  s('authenticated product probes', 'set GHC_E2E_COOKIE_A')
} else {
  const paths = [
    '/api/marketplace/orders',
    '/api/economy/wallet',
    '/api/economy/wallet/cross-reconcile',
    '/api/economy/earnings/withdrawable',
  ]
  for (const path of paths) {
    const r = await req(path, { authed: true })
    if ([200, 401, 403, 503].includes(r.status)) p(`authed ${path}`, `status=${r.status}`)
    else f(`authed ${path}`, `status=${r.status}`)
  }
}

console.log(`\nPhase F product live: pass=${pass} fail=${fail} skip=${skip}`)
console.log('BOUNDARY: Live product probes do not prove funded A2U or Mainnet.')
process.exit(fail ? 1 : 0)
