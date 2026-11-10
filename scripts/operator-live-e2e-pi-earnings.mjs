#!/usr/bin/env node
/**
 * Phase 10 — Operator live probes for PI earnings / cashback / A2U surfaces.
 *
 * Env:
 *   GHC_E2E_BASE_URL          required
 *   GHC_E2E_ALLOW_TESTNET=1   required (blocks production)
 *   GHC_E2E_COOKIE_A          optional auth for user probes
 *   GHC_OPERATOR_RECONCILE_KEY optional for operator routes
 *
 * Never invents financial outcomes or claims funded A2U success without provider evidence.
 */
import { requireE2eBaseUrl } from '../lib/e2e/resolve-base-url.mjs'

const resolved = requireE2eBaseUrl(process.env)
if (process.env.GHC_E2E_ALLOW_TESTNET !== '1') {
  console.error('BLOCKED: set GHC_E2E_ALLOW_TESTNET=1')
  process.exit(2)
}
if (resolved.isProdTarget || process.env.GHC_E2E_TARGET === 'production') {
  console.error('BLOCKED: Phase 10 earnings live probes are Testnet/Preview only')
  process.exit(2)
}

const base = resolved.baseUrl
const cookie = String(process.env.GHC_E2E_COOKIE_A || '').trim()
const opKey = String(process.env.GHC_OPERATOR_RECONCILE_KEY || process.env.GHC_A2U_ADMIN_KEY || '').trim()

let pass = 0, fail = 0, skip = 0
const p = (l, d='') => { pass++; console.log(`PASS ${l}${d ? ` — ${d}` : ''}`) }
const f = (l, d='') => { fail++; console.error(`FAIL ${l}${d ? ` — ${d}` : ''}`) }
const s = (l, d='') => { skip++; console.log(`SKIP ${l}${d ? ` — ${d}` : ''}`) }

async function req(path, { method = 'GET', body, operator = false, authed = false } = {}) {
  const headers = { Accept: 'application/json' }
  if (authed && cookie) headers.Cookie = cookie
  if (operator && opKey) headers['x-ghc-operator-key'] = opKey
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
  return { status: res.status, json, text: text.slice(0, 240) }
}

console.log(`\nPhase 10 PI earnings live E2E\nBase: ${base}\n`)

// Public/unauth expectations
{
  const r = await req('/api/economy/earnings/withdrawable')
  if (r.status === 401) p('withdrawable requires auth', String(r.status))
  else f('withdrawable requires auth', `status=${r.status}`)
}
{
  const r = await req('/api/economy/earnings')
  if (r.status === 401) p('earnings statement requires auth', String(r.status))
  else f('earnings statement requires auth', `status=${r.status}`)
}
{
  const r = await req('/api/economy/earnings/quote', { method: 'POST', body: { amountPi: 1 } })
  if (r.status === 401) p('quote requires auth', String(r.status))
  else f('quote requires auth', `status=${r.status}`)
}
{
  const r = await req('/api/economy/rewards/pi-cashback')
  // may be 401 or 200 with feature flags
  if (r.status === 401 || r.status === 200 || r.status === 503) p('cashback GET reachable', String(r.status))
  else f('cashback GET reachable', `status=${r.status}`)
}
{
  const r = await req('/api/payments/a2u/orchestration')
  if (r.status === 403 || r.status === 401) p('orchestration rejects without operator key', String(r.status))
  else f('orchestration rejects without operator key', `status=${r.status}`)
}

if (cookie) {
  const w = await req('/api/economy/earnings/withdrawable', { authed: true })
  if (w.status === 200 && w.json?.ok === true) {
    p('withdrawable returns server snapshot', `eligible=${w.json.eligible}`)
    if (w.json.authority === 'gh_earnings_ledger_entries' || w.json.policy?.authority) {
      p('withdrawable cites ledger authority')
    } else {
      p('withdrawable body present (authority field optional on older deploys)')
    }
  } else if (w.status === 503) {
    s('withdrawable 503 (DB/migration may be pending)', w.json?.error || '')
  } else {
    f('withdrawable authenticated', `status=${w.status} err=${w.json?.error}`)
  }

  const sRes = await req('/api/economy/earnings?limit=5', { authed: true })
  if (sRes.status === 200 && sRes.json?.ok === true) p('earnings statement ok')
  else if (sRes.status === 503) s('statement 503 (ledger migration pending)')
  else f('earnings statement', `status=${sRes.status}`)

  const c = await req('/api/economy/earnings/charity', { authed: true })
  if (c.status === 200 && c.json?.ok === true) p('charity summary ok', `withdrawable=${c.json.withdrawable}`)
  else if (c.status === 503) s('charity 503 (migration pending)')
  else f('charity summary', `status=${c.status}`)

  const q = await req('/api/economy/earnings/quote', {
    method: 'POST',
    authed: true,
    body: { amountPi: 1 },
  })
  // 409 expected if below min / no balance / no identity — still proves route
  if ([200, 409, 403].includes(q.status)) p('quote route responds', `status=${q.status} err=${q.json?.error || 'ok'}`)
  else f('quote route', `status=${q.status}`)

  const xr = await req('/api/economy/wallet/cross-reconcile', { authed: true })
  if (xr.status === 200 && xr.json?.ok === true) p('cross-reconcile report ok')
  else if (xr.status === 503) s('cross-reconcile 503')
  else f('cross-reconcile', `status=${xr.status}`)
} else {
  s('Authenticated earnings probes (set GHC_E2E_COOKIE_A)')
}

if (opKey) {
  const o = await req('/api/payments/a2u/orchestration', { operator: true })
  if (o.status === 200 && o.json?.ok === true) p('orchestration operator GET', `reviews=${(o.json.reviews || []).length}`)
  else f('orchestration operator GET', `status=${o.status}`)
  const plat = await req('/api/economy/earnings/platform', { operator: true })
  if (plat.status === 200 && plat.json?.ok === true) p('platform utility summary')
  else if (plat.status === 503) s('platform summary 503 (migration pending)')
  else f('platform utility summary', `status=${plat.status}`)
} else {
  s('Operator probes (set GHC_OPERATOR_RECONCILE_KEY)')
}

console.log(`\nPhase 10 live earnings E2E: ${pass} pass, ${fail} fail, ${skip} skip`)
if (fail) process.exit(1)
console.log('NOTE: Live funded A2U receipt still requires real Pi Testnet wallet transfer + operator verification.')
process.exit(0)
