#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const routes = [
  'app/api/marketplace/payouts/route.ts',
  'app/api/marketplace/payouts/bank-requests/route.ts',
  'app/api/marketplace/payouts/banks/route.ts',
  'app/api/marketplace/payouts/bank-beneficiaries/route.ts',
  'app/api/marketplace/payouts/bank-account/resolve/route.ts',
  'app/api/marketplace/payouts/[requestId]/execute-bank/route.ts',
  'app/api/marketplace/payouts/[requestId]/reconcile/route.ts',
  'app/api/marketplace/payouts/[requestId]/reconcile-bank/route.ts',
  'app/api/marketplace/payouts/[requestId]/reconcile-ghc/route.ts',
  'app/api/marketplace/payouts/[requestId]/transition/route.ts',
  'app/api/marketplace/payouts/[requestId]/transition-bank/route.ts',
  'app/api/marketplace/payouts/[requestId]/resolve-bank-exception/route.ts',
  'app/api/admin/creator-rewards/settle/route.ts',
  'app/api/payments/reconciliation/route.ts',
  'app/api/economy/wallet/cross-reconcile/route.ts',
  'app/api/economy/earnings/route.ts',
  'app/api/economy/earnings/withdrawable/route.ts',
  'app/api/economy/earnings/quote/route.ts',
  'app/api/economy/earnings/adapters/route.ts',
  'app/api/economy/earnings/charity/route.ts',
  'app/api/economy/earnings/registration-bonus/route.ts',
]
const failures = []
for (const file of routes) {
  if (!fs.existsSync(file)) { failures.push(`${file}: missing`); continue }
  const source = fs.readFileSync(file, 'utf8')
  if (!source.includes('checkDurableRateLimit')) failures.push(`${file}: durable limiter missing`)
  if (!/await\s+checkDurableRateLimit\(/.test(source)) failures.push(`${file}: limiter must be awaited`)
  if (!/onUnavailable\s*:\s*["']deny["']/.test(source)) failures.push(`${file}: unavailable policy must fail closed`)
  if (/\bcheckRateLimit\s*\(/.test(source) || source.includes('@/lib/server/economy/rate-limit')) failures.push(`${file}: process-local limiter remains`)
  if (!source.includes('durableRateLimitStatus')) failures.push(`${file}: durable 429/503 status mapping missing`)
  if (!source.includes('durableRateLimitCode')) failures.push(`${file}: durable error code mapping missing`)
}
const controlPlane = fs.readFileSync('lib/server/security/control-plane.ts', 'utf8')
if (!controlPlane.includes('gh_security_rate_limit_consume')) failures.push('control plane: durable consume RPC missing')
if (!controlPlane.includes('options.onUnavailable === "deny"')) failures.push('control plane: deny-on-unavailable behavior missing')
const migrationDir = 'supabase/migrations'
const migrations = fs.readdirSync(migrationDir).filter((name) => /^\d+.*\.sql$/.test(name))
if (migrations.length !== 177) failures.push(`migration inventory changed unexpectedly: ${migrations.length}; expected 177 after Phase 23; reconcile before release`)
const prefixes = migrations.map((name) => name.match(/^\d+/)?.[0]).filter(Boolean)
if (new Set(prefixes).size !== prefixes.length) failures.push('duplicate migration numeric prefixes detected')
if (failures.length) {
  console.error(`Phase 20 payout durable-limit gate: ${failures.length} failure(s)`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log(`Phase 20 payout durable-limit gate: PASS (${routes.length} route modules; durable fail-closed controls; ${migrations.length} migrations present)`)
