#!/usr/bin/env node
/** Regression checks for floating daily claim, compact header, and mature reward settlement. */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(fileURLToPath(new URL('..', import.meta.url)))
const read = (p) => readFileSync(join(root, p), 'utf8')
const app = read('components/ghc/app.tsx')
const actions = read('components/ghc/premium-surface-actions.tsx')
const bell = read('components/ghc/notification-bell.tsx')
const prompt = read('components/ghc/daily-claim-prompt.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const route = read('app/api/economy/rewards/claim-matured/route.ts')
const db = read('lib/server/economy/db.ts')
const migration = read('supabase/migrations/20261025090001_backfill_daily_claim_48h_metadata.sql')
const css = read('app/globals.css')
const checks = [
  ['old global notification overlay removed from app shell', !app.includes('Global notification entry point') && !app.includes('NotificationBellLazy')],
  ['notification is in the same shared row after Marketplace and Ecosystem', actions.indexOf('Open Marketplace') < actions.indexOf('Open Ecosystem') && actions.indexOf('<NotificationBell />') > actions.indexOf('Open Ecosystem')],
  ['notification bell uses gold visual treatment', /text-amber-500/.test(bell) && /border-amber-400/.test(bell)],
  ['daily claim action floats above bottom navigation', /fixed z-\[150\]/.test(prompt) && /--gh-bottom-nav-height/.test(prompt)],
  ['daily claim uses official GHC coin with lightning effects and compact non-modal popover', /<GhcCoinIcon size=\{42\}/.test(prompt) && /gh-daily-lightning-one/.test(prompt) && /aria-modal="false"/.test(prompt) && /gh-daily-claim-popover/.test(css)],
  ['daily claim does not auto-open a blocking popup on page entry', !prompt.includes('autoPromptedKeyRef') && !prompt.includes('setOpen(true)\n  }, [userId, status?.claimable')],
  ['claim FAB has pointer-events isolated so feed content remains interactive', /pointer-events-none fixed z-\[150\]/.test(prompt) && /pointer-events-auto relative/.test(prompt)],
  ['loading fallback uses GreenHaven logo blink', /gh-brand-loading-blink/.test(app) && /gh-connect-logo\.png/.test(app) && /gh-brand-loading-blink/.test(css)],
  ['brand blink respects reduced-motion preferences', /prefers-reduced-motion: reduce/.test(css)],
  ['wallet invokes durable matured-claim reconciliation before authoritative refresh', /api\/economy\/rewards\/claim-matured/.test(wallet) && wallet.indexOf('claim-matured') < wallet.indexOf('await refreshWalletAuthority()')],
  ['mature reconciliation authenticates the user and requires durable database', /resolveAuthenticatedUser\(request\.headers\)/.test(route) && /isDatabaseConfigured\(\)/.test(route)],
  ['mature reconciliation only settles expired-lock daily claims', /DAILY_CLAIM_V12/.test(db) && /48 \* 60 \* 60 \* 1000/.test(route) && /rpcClaimPending\(auth\.userId, tx\.id\)/.test(route) && /created_at: `lt\.\$\{cutoff\.toISOString\(\)\}`/.test(db)],
  ['mature reconciliation does not trust client amount or user ID', !/request\.json\(\)/.test(route) && /rpcClaimPending\(auth\.userId/.test(route)],
  ['legacy metadata backfill touches only pending positive Daily Claim rows', /status = 'pending'/.test(migration) && /amount > 0/.test(migration) && /source_event = 'DAILY_CLAIM_V12'/.test(migration)],
  ['release version is synchronized', /APP_RELEASE_VERSION = "0\.91\.5"/.test(read('lib/app-release.ts')) && /"version": "0\.91\.5"/.test(read('package.json'))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nPhase 31 contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
