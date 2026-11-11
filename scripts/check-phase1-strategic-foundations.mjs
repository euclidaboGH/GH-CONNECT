#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const owners = read('lib/architecture/domain-ownership.ts')
const ledger = read('lib/server/earnings/unified-ledger.ts')
const piAtomic = read('lib/wallet/pi-atomic.ts')
const assets = read('lib/asset-separation.ts')
const reconcile = read('lib/server/economy/cross-feature-reconcile.ts')
const pin = read('lib/server/identity/withdrawal-pin-proof.ts')
const durable = read('lib/server/economy/durable-emission.ts')
const migrationFiles = readdirSync(join(root, 'supabase/migrations')).filter((x) => x.endsWith('.sql')).sort()
const mappedPaths = [...owners.matchAll(/\"((?:lib|app|contexts|features|components)\/[^\"]+)\"/g)].map((m) => m[1])
const manifest = read('MIGRATION-SOURCE-MANIFEST.csv').trim().split(/\r?\n/).slice(1).map((x) => x.split(',')[0]).filter(Boolean).sort()
const checks = [
  ['server-owned domains include identity, both wallets, marketplace, membership, messaging and feed', ['identity','walletGhc','walletPiEarnings','marketplace','membership','messaging','feed'].every((x) => new RegExp(`\\b${x}:\\s*\\{`).test(owners))],
  ['server-owned domains include rewards, communities, notifications, trust/safety and payments', ['rewards','communities','notifications','trustSafety','payments'].every((x) => new RegExp(`\\b${x}:\\s*\\{`).test(owners))],
  ['financial domain list includes both wallet rails, rewards, marketplace, membership and payments', /FINANCIAL_DOMAINS: DomainKey\[\].*walletGhc.*walletPiEarnings.*marketplace.*membership.*rewards.*payments/.test(owners)],
  ['Pi ledger atomic input validator requires safe integers', /Number\.isSafeInteger\(value\)/.test(piAtomic) && /isValidPiAtomic/.test(ledger)],
  ['ledger credit, reserve, settle and release reject invalid amount/identity inputs', (ledger.match(/INVALID_LEDGER_INPUT/g) || []).length >= 4],
  ['payout creation verifies gross = fee + net and restricts this source path to Testnet', /input\.grossAtomic === input\.feeAtomic \+ input\.netAtomic/.test(ledger) && /input\.network !== "Pi Testnet"/.test(ledger)],
  ['large withdrawal fee preview uses BigInt arithmetic', /BigInt\(grossAtomic\) \* BigInt\(feeBps\)/.test(piAtomic)],
  ['Pi and GHC free conversion remains disabled', /conversionEnabled: false/.test(assets) && /PI: \{[\s\S]*?convertibleToGhc: false/.test(assets) && /GHC: \{[\s\S]*?convertibleToPi: false/.test(assets)],
  ['cross-feature reconciliation is explicitly read-only', /read-only/.test(reconcile) && /never invents balances or writes ledgers/i.test(reconcile)],
  ['withdrawal PIN proof is short-lived and HMAC-bound', /createHmac\("sha256"/.test(pin) && /TTL_MS/.test(pin) && /timingSafeEqual/.test(pin)],
  ['durable activity grants use database RPC rather than process-local state', /ghc_activity_try_grant/.test(durable) && /isDatabaseConfigured/.test(durable)],
  ['all declared domain ownership paths exist in this source tree', mappedPaths.length > 0 && mappedPaths.every((p) => existsSync(join(root, p)))],
  ['migration manifest filenames exactly match current SQL migration tree', migrationFiles.length === manifest.length && migrationFiles.every((x, i) => x === manifest[i])],
  ['existing migration policy register remains present', existsSync(join(root, 'docs/architecture/MIGRATION_READINESS_STATES.md'))],
  ['backup artifact verifier remains available', existsSync(join(root, 'scripts/verify-database-backup-artifact.mjs'))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nPhase I strategic foundation checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
