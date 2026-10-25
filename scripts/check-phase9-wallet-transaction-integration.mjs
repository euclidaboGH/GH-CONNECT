#!/usr/bin/env node
/** Phase 9 wallet transaction integration source contracts; no DB writes or provider calls. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const wallet = read('features/wallet/wallet-screen.tsx')
const store = read('lib/server/payments/intent-store.ts')
const api = read('app/api/payments/intents/route.ts')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const checks = [
  ['release/package/lock versions agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['phase report exists', fs.existsSync(path.join(process.cwd(), 'PHASE-9-WALLET-TRANSACTION-INTEGRATION.md'))],
  ['Pi payment amount handles numeric strings safely', /const value = raw\.amountPi \?\? raw\.amount[\s\S]{0,180}Number\(value\)/.test(wallet)],
  ['Pi currency remains explicit and defaults to Pi', /currency: String\(raw\.currency \|\| "PI"\)\.toUpperCase\(\)/.test(wallet)],
  ['product label is read from authoritative metadata when present', /raw\.productLabel \|\| raw\.title/.test(wallet) && /metadata.*productLabel/s.test(wallet)],
  ['reference identifier is available to the user', /referenceId: String\(raw\.referenceId \|\| raw\.reference_id \|\| ""\)/.test(wallet) && /Ref \$\{intent\.referenceId/.test(wallet)],
  ['provider payment identifier is normalized', /raw\.providerPaymentId \|\| raw\.paymentId \|\| raw\.piPaymentId/.test(wallet)],
  ['missing creation time is not fabricated as current time in UI', /return undefined\s*\}\)\(\)/.test(wallet) && !/typeof raw\.created_at === "number"\s*\? raw\.created_at\s*:\s*Date\.now\(\)/.test(wallet)],
  ['missing creation time is not fabricated in durable store mapper', /createdAt: row\.created_at \? new Date\(String\(row\.created_at\)\)\.getTime\(\) : 0/.test(store) && /createdAt: Number\.isFinite\(Number\(row\.createdAt\)\)[^,]+: 0/.test(store)],
  ['purpose labels distinguish major payment categories', ['Membership payment','Marketplace purchase','Sponsored listing','Digital product purchase','Premium feature','Service payment','Creator earnings','Refund'].every(x => wallet.includes(x))],
  ['payment lifecycle states distinguish completed from fulfilled', wallet.includes('Paid · fulfilment pending') && wallet.includes('COMPLETED:') && wallet.includes('FULFILLED:')],
  ['pending filter includes non-terminal payment lifecycle states', /\["created", "approval_pending", "approved", "user_submitted", "completion_pending", "incomplete"\]/.test(wallet)],
  ['search includes reference and product labels', /i\.productLabel \|\| "".*i\.referenceId \|\| ""/.test(wallet)],
  ['date range filter still applies to Pi history', /if \(startMs <= 0\) return searchable[\s\S]{0,120}createdAt/.test(wallet)],
  ['Pi and GHC rails are kept separate', /GHC ledger and π payments are kept on separate rails/.test(wallet)],
  ['history endpoint authenticates user', /resolveAuthenticatedUser\(request\.headers\)/.test(api)],
  ['history endpoint only queries authenticated user', /listIntentsForUserAsync\(auth\.userId\)/.test(api)],
  ['history response is not cached', /Cache-Control": "no-store"/.test(api)],
  ['wallet does not infer missing payment amount as zero', /return Number\.isFinite\(amount\) && amount >= 0 \? amount : undefined/.test(wallet)],
  ['GHC ledger source remains server authoritative', /source: "ghc_transactions"[\s\S]*authority: "server_ledger"/.test(read('app/api/economy/wallet/summary/route.ts'))],
  ['read-only payment reconciliation summary is present', /const piReconciliation = useMemo/.test(wallet) && /Payment checks/.test(wallet)],
  ['reconciliation flags completed-but-unfulfilled intents', /normalize\(i\.status\) === "COMPLETED"/.test(wallet) && /Paid, fulfilment not confirmed/.test(wallet)],
  ['reconciliation flags paid records missing provider payment IDs', /paidMissingProviderId = piIntents\.filter/.test(wallet)],
  ['reconciliation warns that feature fulfilment is not verified', /Marketplace and membership have explicit record checks/.test(wallet) && /No records are changed by these checks/.test(wallet)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 9 wallet transaction integration: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
