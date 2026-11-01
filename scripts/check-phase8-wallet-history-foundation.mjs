#!/usr/bin/env node
/** Source-level regression checks for wallet history visibility. No network or DB writes. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wallet = readFileSync(join(root, 'features/wallet/wallet-screen.tsx'), 'utf8')
const api = readFileSync(join(root, 'app/api/payments/intents/route.ts'), 'utf8')
const reconciliationApi = readFileSync(join(root, 'app/api/payments/reconciliation/route.ts'), 'utf8')
const walletV2 = readFileSync(join(root, 'lib/domains/wallet-v2.ts'), 'utf8')
const walletProvider = readFileSync(join(root, 'contexts/domains/wallet-read-provider.tsx'), 'utf8')
const walletSummaryApi = readFileSync(join(root, 'app/api/economy/wallet/summary/route.ts'), 'utf8')
const checks = [
  ['Pi history has explicit error state', /piIntentsError, setPiIntentsError/.test(wallet)],
  ['Non-OK history response is not treated as empty history', /if \(!res\.ok\)\s*\{[\s\S]{0,350}setPiIntentsError/.test(wallet)],
  ['Network failure preserves prior loaded rows', /catch \{\s*if \(!cancelled\) setPiIntentsError/.test(wallet) && !/catch \{\s*if \(!cancelled\) setPiIntents\(\[\]\)/.test(wallet)],
  ['History error is visible and accessible', /Payment history unavailable/.test(wallet) && /role="alert"/.test(wallet)],
  ['History retry re-runs fetch', wallet.includes('Retry history') && wallet.includes('setTick((n) => n + 1)')],
  ['Pi history supports search filtering', /const filteredPiIntents = useMemo[\s\S]{0,400}const q = query\.trim\(\)\.toLowerCase\(\)/.test(wallet)],
  ['Pi and GHC transaction rails remain separated', /GHC ledger and π payments are kept on separate rails/.test(wallet)],
  ['Payment history API requires authenticated user', /resolveAuthenticatedUser\(request\.headers\)/.test(api) && /AUTH_REQUIRED/.test(api)],
  ['Payment history API is user-scoped, not client userId scoped', /listIntentsForUserAsync\(auth\.userId\)/.test(api) && /never accept client userId override/.test(api)],
  ['Payment history is served without caching', /Cache-Control": "no-store"/.test(api)],
  ['Pi history API explicitly filters provider and currency', /provider === \"pi\" && intent\.currency === \"PI\"/.test(api) && /rail: \"PI\"/.test(api)],
  ['Reconciliation checks only Pi payment rail', /provider === \"pi\" && intent\.currency === \"PI\"/.test(reconciliationApi) && /rail: \"PI\"/.test(reconciliationApi)],
  ['Wallet snapshot validates currency and finite non-negative balances', /normalizeWalletV2Snapshot/.test(walletV2) && /WALLET_INVALID_CURRENCY/.test(walletV2) && /finiteNonNegative/.test(walletV2)],
  ['Wallet snapshot requires a bounded canonical user ID', /WALLET_INVALID_USER_ID/.test(walletV2) && /raw\.userId\.trim\(\)\.length > 160/.test(walletV2)],
  ['Wallet pending count must be an integer', /Number\.isSafeInteger\(amounts\.pendingCount\)/.test(walletV2)],
  ['Wallet timestamps reject implausible future values', /Date\.now\(\) \+ 5 \* 60_000/.test(walletV2)],
  ['Wallet escrow rail is allowlisted', /supportedEscrowRails/.test(walletV2) && /supportedEscrowRails\.has\(holdsRecord\.escrowRail\)/.test(walletV2)],
  ['Wallet summary uses no-store headers for auth, config, error, and success responses', (walletSummaryApi.match(/headers: noStore/g) || []).length >= 4 && /no-cache, max-age=0, must-revalidate/.test(walletSummaryApi)],
  ['Wallet snapshot refresh rejects out-of-order responses', /requestSequence = useRef\(0\)/.test(walletProvider) && /sequence !== requestSequence\.current/.test(walletProvider)],
  ['Wallet refresh failure preserves last server-confirmed snapshot as stale', /previous\.source === \"server\"/.test(walletProvider) && /status: \"error\"/.test(walletProvider) && /last server-confirmed snapshot/.test(walletProvider)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nWallet history foundation: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
