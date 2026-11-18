#!/usr/bin/env node
/**
 * Static regression guard for the 2026-11-09 security audit (see docs/SECURITY-AUDIT-0.338.6.md).
 * Source-level only: it proves the hardening is present in the repository, not that it is deployed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (p) => readFileSync(p, 'utf8')
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name === 'route.ts') out.push(full)
  }
  return out
}
const routes = walk('app')
const checks = []
const add = (label, ok) => checks.push([label, Boolean(ok)])

// 1. Shared operator-key verifier
const helper = existsSync('lib/server/security/operator-key.ts') ? read('lib/server/security/operator-key.ts') : ''
add('operator-key helper enforces a minimum length and constant-time digest comparison',
  helper.includes('OPERATOR_KEY_MIN_BYTES = 32') && helper.includes('timingSafeEqual(digest(supplied), digest(expected))'))

// 2. No privileged route accepts a key of arbitrary length
const payoutRoutes = routes.filter((p) => p.includes('marketplace/payouts/[requestId]/') || p.includes('payments/a2u/create') || p.includes('payments/a2u/complete'))
add('payout and A2U privileged routes use the shared verifier', payoutRoutes.length >= 8 && payoutRoutes.every((p) => read(p).includes('operatorKeyAuthorized(')))
add('no route accepts an operator key with only a "length > 0" check', routes.every((p) => !/expected\.length\s*>\s*0\s*&&/.test(read(p))))

// 3. Request bodies are bounded before they are read
add('no route reads an unbounded req.json()', routes.every((p) => !/\b(?:request|req)\.json\(\)/.test(read(p))))
add('no route reads an unbounded req.text()', routes.every((p) => !/\b(?:request|req)\.text\(\)/.test(read(p))))
add('share target refuses to buffer large multipart bodies', read('app/share/route.ts').includes('MAX_SHARE_BODY_BYTES'))

// 4. Privileged routes use the durable fail-closed limiter, not the per-instance one
for (const p of ['app/api/payments/a2u/create/route.ts', 'app/api/payments/a2u/complete/route.ts', 'app/api/admin/creator-rewards/fund/route.ts']) {
  const src = read(p)
  add(`${p} uses the durable fail-closed rate limiter`, src.includes('checkDurableRateLimit(') && src.includes('onUnavailable: "deny"') && !src.includes('economy/rate-limit'))
}

// 5. Money-moving and social mutations carry a per-user durable throttle
const throttled = [
  'payments/orders', 'payments/fulfill', 'payments/incomplete', 'payments/intents/[intentId]/cancel',
  'marketplace/orders/[orderId]/pay', 'marketplace/orders/[orderId]/transition', 'marketplace/listings',
  'economy/transfer-requests', 'economy/transfer-requests/[requestId]/accept', 'economy/account',
  'connections/request', 'referral/attribute', 'governance/reports', 'verification/request',
]
for (const r of throttled) add(`app/api/${r} enforces the per-user mutation throttle`, read(`app/api/${r}/route.ts`).includes('enforceUserMutationRateLimit('))

// 6. Detailed diagnostics are operator-only
for (const r of ['health/withdrawals', 'economy/health', 'payments/health', 'release/beta-readiness', 'release/final-audit']) {
  add(`app/api/${r} restricts detailed diagnostics`, read(`app/api/${r}/route.ts`).includes('diagnosticsDetailAllowed('))
}

// 7. Deployment headers
const vercel = JSON.parse(read('vercel.json'))
const headerMap = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]))
add('CSP forbids plugins, base-tag injection and cross-origin form posts',
  ['object-src \'none\'', 'base-uri \'self\'', 'form-action \'self\''].every((d) => headerMap['Content-Security-Policy']?.includes(d)))
add('HSTS covers subdomains', /includeSubDomains/.test(headerMap['Strict-Transport-Security'] || ''))

// 8. Dependency pinning and lockfile coherence (npm ci fails when these drift)
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const lockRoot = lock.packages[''].dependencies || {}
add('third-party Pi SDK packages are pinned to exact versions', Object.entries(pkg.dependencies).filter(([n]) => n.startsWith('@swetate/')).every(([, v]) => /^\d+\.\d+\.\d+$/.test(v)))
add('package.json dependencies match the lockfile root exactly', Object.keys(pkg.dependencies).every((n) => lockRoot[n] === pkg.dependencies[n]))

// 9. Registration
add('security audit check is registered in prebuild', (pkg.scripts['prebuild:checks'] || '').includes('check-security-audit-20261109.mjs'))
add('security audit check is registered in static verification', (pkg.scripts['verify:static'] || '').includes('check-security-audit-20261109.mjs'))

let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures += 1
}
if (failures) {
  console.error(`\n${failures} security audit check(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} security audit checks passed`)
