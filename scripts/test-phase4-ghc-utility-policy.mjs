import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const routePath = 'app/api/economy/policy/route.ts'
const policyPath = 'lib/server/economy/public-policy.ts'
const catalogPath = 'lib/server/economy/spend-catalog.ts'
const walletPath = 'features/wallet/wallet-screen.tsx'
const migrationPath = 'supabase/migrations/20261022010091_company_revenue_event_journal.sql'

assert.ok(existsSync(routePath), 'public economy policy route exists')
const route = read(routePath)
const policy = read(policyPath)
const catalog = read(catalogPath)
const wallet = read(walletPath)
const config = read('lib/server/economy/economic-config.ts')
const withdrawal = read('lib/server/economy/withdrawal.ts')
const purchase = read('app/api/economy/purchase-ghc/route.ts')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')

assert.match(route, /GET\(\)/, 'policy route is read-only GET')
assert.match(route, /Cache-Control.*public, max-age=60/, 'public policy response has short bounded cache')
assert.match(route, /X-Content-Type-Options.*nosniff/, 'policy response adds nosniff')
assert.match(policy, /ECONOMY_VERSION/, 'policy version derives from canonical config')
assert.match(policy, /CLAIM_GROSS_BY_DAY/, 'daily base schedule derives from canonical config')
assert.match(policy, /listPublicSpendCatalog\(\)/, 'public policy reuses authoritative spend catalog')
assert.match(policy, /externalRedemptionPromised: false/, 'no external redemption promise')
assert.match(policy, /piToGhcPurchaseAvailable: false/, 'Pi-funded GHC acquisition remains unavailable')
assert.match(policy, /areGhcPiWithdrawalsEnabled\(\)/, 'withdrawal disclosure reflects the server gate')
assert.match(policy, /clientMinting: false/, 'policy explicitly prohibits client minting')
assert.match(policy, /ledgerIsBalanceAuthority: true/, 'ledger remains balance authority')
assert.match(catalog, /export function listPublicSpendCatalog/, 'catalog exposes a safe public projection')
assert.match(catalog, /amountGhc: entry\.amountGhc/, 'public catalog amounts come from fixed server catalog')
assert.match(catalog, /entry\.feeGhc === undefined/, 'optional fee is projected without leaking internal object')
assert.match(config, /ECONOMY_VERSION = "1\.2"/, 'economic version is not silently changed')
assert.match(withdrawal, /process\.env\.GHC_WITHDRAWALS_ENABLED === "true"/, 'withdrawals remain fail-closed')
assert.match(purchase, /getGhcPack\(productId\)/, 'Pi purchase pack selection uses the server-owned catalog')
assert.match(purchase, /ghc_credit_pack_purchase/, 'Pi purchase uses the durable idempotent credit RPC')
assert.match(purchase, /BUY_GHC_DISABLED/, 'Pi-funded GHC acquisition remains explicitly feature-gated')
assert.match(wallet, /\/api\/economy\/policy/, 'wallet fetches server policy')
assert.match(wallet, /Utility policy & current pricing/, 'wallet presents economy transparency')
assert.match(wallet, /not an investment or a promise of cash value/, 'wallet discloses no investment/cash-value promise')
assert.match(wallet, /fixedSpendCatalog\.map/, 'wallet renders current server-owned prices')
assert.match(wallet, /economyPolicyRetry/, 'wallet policy fetch can be retried after a transient failure')
assert.match(wallet, /Retry policy/, 'wallet exposes a user-triggered policy retry')
assert.match(wallet, /\[economyPolicyRetry\]/, 'retry counter re-runs the read-only policy fetch')
assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version), 'package version is valid semver')
assert.equal(lock.version, pkg.version, 'lockfile root version matches package')
assert.equal(lock.packages[''].version, pkg.version, 'lockfile package entry matches package')
assert.match(release, new RegExp(`APP_RELEASE_VERSION = "${pkg.version.replaceAll('.', '\\.')}"`), 'release metadata matches package version')
assert.match(pkg.scripts['ci:verify'], /test:phase4-ghc-utility-policy/, 'Phase 4 test is part of CI verification')
assert.ok(existsSync(migrationPath), 'Phase 3 revenue migration preserved; no replacement migration added')

console.log('Phase 4 GHC utility policy: 27 assertions passed')
