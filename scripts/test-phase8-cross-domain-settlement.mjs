#!/usr/bin/env node
/** Phase 8: app commission math must match durable eight-decimal proceeds snapshots. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { splitMarketplaceCommission } from '../lib/server/marketplace/commission.ts'

const migrationPath = 'supabase/migrations/20261030010009_phase20_marketplace_net_proceeds.sql'
const migration = fs.readFileSync(migrationPath, 'utf8')
const activate = fs.readFileSync('app/api/membership/activate/route.ts', 'utf8')
const membershipDomain = fs.readFileSync('lib/domains/membership-domain.ts', 'utf8')

const checks = [
  ['commission app and SQL use eight-decimal precision', /gross\.toFixed\(8\)/.test(fs.readFileSync('lib/server/marketplace/commission.ts', 'utf8')) && /floor\(\(NEW\.total_amount \* v_bps \/ 10000\)::numeric \* 100000000\) \/ 100000000/.test(migration)],
  ['proceeds SQL keeps platform fee default at 500 basis points', /v_bps integer := 500/.test(migration)],
  ['GHC membership UI creates a per-attempt idempotency reference', /purchaseAttemptId/.test(membershipDomain) && /spendReferenceId: `membership_\$\{tier\}_\$\{periodKey\}_\$\{purchaseAttemptId\}`/.test(membershipDomain)],
  ['Pi membership activation requires exact catalog product and server price', /getMembershipPiPrice\(tier, paidMonths\)\.chargePi/.test(activate) && /productId !== expected/.test(activate)],
]
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
assert.equal(checks.every(([, ok]) => ok), true, 'Phase 8 cross-domain settlement source contract failed')

const originalBps = process.env.GHC_MARKETPLACE_PLATFORM_FEE_BPS
const originalFloor = process.env.GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR
try {
  process.env.GHC_MARKETPLACE_PLATFORM_FEE_BPS = '1250'
  process.env.GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR = '25'
  const split = splitMarketplaceCommission({ grossAmount: 10.12345678, currency: 'PI' })
  assert.equal(split.grossMinor, 10.12345678)
  assert.equal(split.platformFeeBps, 500)
  assert.equal(split.platformFeeMinor, 0.50617283)
  assert.equal(split.sellerProceedsMinor, 9.61728395)
  assert.equal(split.platformFeeMinor + split.sellerProceedsMinor, split.grossMinor)
  console.log('PASS runtime fee overrides cannot diverge from canonical SQL 500 bps policy')

  const capped = splitMarketplaceCommission({ grossAmount: 0.1, currency: 'GHC' })
  assert.equal(capped.platformFeeMinor, 0.005)
  assert.equal(capped.sellerProceedsMinor, 0.095)
  console.log('PASS commission remains 500 bps with no unmirrored minimum-fee floor')

  const invalid = splitMarketplaceCommission({ grossAmount: Number.NaN, currency: 'PI' })
  assert.equal('error' in invalid, true)
  console.log('PASS non-finite gross amount is rejected')
} finally {
  if (originalBps === undefined) delete process.env.GHC_MARKETPLACE_PLATFORM_FEE_BPS
  else process.env.GHC_MARKETPLACE_PLATFORM_FEE_BPS = originalBps
  if (originalFloor === undefined) delete process.env.GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR
  else process.env.GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR = originalFloor
}
console.log('Phase 8 cross-domain settlement tests: PASS')
