#!/usr/bin/env node
/** Source-level regression checks for wallet history visibility. No network or DB writes. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wallet = readFileSync(join(root, 'features/wallet/wallet-screen.tsx'), 'utf8')
const api = readFileSync(join(root, 'app/api/payments/intents/route.ts'), 'utf8')
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
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nWallet history foundation: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
