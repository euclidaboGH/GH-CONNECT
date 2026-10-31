#!/usr/bin/env node
/** Phase 9 wallet transaction integration source contracts; no DB writes or provider calls. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const wallet = read('features/wallet/wallet-screen.tsx')
const projection = read('lib/domains/pi-transaction-normalizer.ts')
const reconciliation = read('app/api/payments/reconciliation/route.ts')
const store = read('lib/server/payments/intent-store.ts')
const api = read('app/api/payments/intents/route.ts')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const checks = [
  ['release/package/lock versions agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['phase report exists', fs.existsSync(path.join(process.cwd(), 'docs/archive/phase-notes/PHASE-9-WALLET-TRANSACTION-INTEGRATION.md'))],
  ['Pi payment amount handles numeric strings safely', /rawAmount = raw\.amountPi \?\? raw\.amount/.test(projection) && /Number\(rawAmount\)/.test(projection)],
  ['Pi projection requires a positive amount and rejects non-decimal/coerced values', /rawAmount === null \|\| rawAmount === undefined/.test(projection) && /parsed <= 0/.test(projection) && /typeof rawAmount !== \"number\" && typeof rawAmount !== \"string\"/.test(projection) && /\^\(\?:0\|\[1-9\]\\d\*\)\(\?:\\.\\d\{1,8\}\)\?\$/.test(projection)],
  ['Pi projection bounds identifiers and rejects control characters', /safeIdentifier/.test(projection) && /MAX_PROVIDER_PAYMENT_ID_LENGTH/.test(projection) && /CONTROL_CHARS/.test(projection)],
  ['Pi projection rejects implausibly future timestamps', /Date\.now\(\) \+ 5 \* 60_000/.test(projection)],
  ['malformed persisted Pi amounts reject the history row', /if \(!Number\.isFinite\(parsed\) \|\| parsed <= 0/.test(projection)],
  ['explicit blank Pi amounts are rejected rather than treated as absent', /rawAmount === null \|\| rawAmount === undefined/.test(projection) && /amountFormat/.test(projection) === false],
  ['Pi amounts enforce supported magnitude and precision', /parsed >= 10_000_000_000/.test(projection) && /Number\(parsed\.toFixed\(8\)\) !== parsed/.test(projection)],
  ['Pi currency is explicit and unknown currencies are not coerced to Pi', /currency !== "PI"/.test(projection) && /x\.currency === "PI"/.test(wallet) && /provider === "pi" && intent\.currency === "PI"/.test(api)],
  ['product label is read from persisted metadata when present', /raw\.productLabel, raw\.title/.test(projection) && /asRecord\(raw\.metadata\)\?\.productLabel/.test(projection)],
  ['reference identifier is normalized and available to the user', /raw\.referenceId, raw\.reference_id/.test(projection) && /Ref \$\{intent\.referenceId/.test(wallet)],
  ['provider payment identifier is normalized', /raw\.providerPaymentId, raw\.paymentId, raw\.piPaymentId/.test(projection)],
  ['missing creation time is not fabricated as current time in UI', /createdAt: timestamp\(raw\.createdAt \?\? raw\.created_at\)/.test(projection) && /Date\.now\(\) \+ 5 \* 60_000/.test(projection)],
  ['missing creation time is not fabricated in durable store mapper', /createdAt: row\.created_at \? new Date\(String\(row\.created_at\)\)\.getTime\(\) : 0/.test(store) && /createdAt: Number\.isFinite\(Number\(row\.createdAt\)\)[^,]+: 0/.test(store)],
  ['purpose labels distinguish major payment categories', ['Membership payment','Marketplace purchase','Sponsored listing','Digital product purchase','Premium feature','Service payment','Creator earnings','Refund'].every(x => projection.includes(x)) && /paymentPurposeLabel\(intent\.purpose\)/.test(wallet)],
  ['payment lifecycle states distinguish completed from fulfilled', wallet.includes('Paid · fulfilment pending') && wallet.includes('COMPLETED:') && wallet.includes('FULFILLED:')],
  ['pending filter includes non-terminal payment lifecycle states', /\["created", "approval_pending", "approved", "user_submitted", "completion_pending", "incomplete"\]/.test(wallet)],
  ['search includes reference and product labels', /i\.productLabel \|\| "".*i\.referenceId \|\| ""/.test(wallet)],
  ['date range filter still applies to Pi history', /if \(startMs <= 0\) return searchable[\s\S]{0,120}createdAt/.test(wallet)],
  ['Pi and GHC rails are kept separate', /GHC ledger and π payments are kept on separate rails/.test(wallet)],
  ['intent creation rejects boolean, blank, excessive-precision, and malformed amounts', /const rawAmount = body\.amount/.test(api) && /amountFormatValid/.test(api) && /Number\(amount\.toFixed\(8\)\) !== amount/.test(api)],
  ['intent creation rejects malformed metadata and control characters in references/keys', /body\.metadata !== undefined &&/.test(api) && /typeof rawReferenceId !== \"string\"/.test(api) && /INVALID_REFERENCE_ID/.test(api) && /INVALID_IDEMPOTENCY_KEY/.test(api)],
  ['payment intent route disables caching for auth and validation errors', /const NO_STORE =/.test(api) && /AUTH_REQUIRED[\s\S]{0,100}headers: NO_STORE/.test(api) && /INVALID_PURPOSE[\s\S]{0,100}headers: NO_STORE/.test(api)],
  ['history endpoint authenticates user', /resolveAuthenticatedUser\(request\.headers\)/.test(api)],
  ['history endpoint only queries authenticated user', /listIntentsForUserAsync\(auth\.userId\)/.test(api)],
  ['history response is not cached', /Cache-Control": "no-store"/.test(api)],
  ['wallet does not infer missing payment amount as zero', /amountPi/.test(projection) && /if \(!Number\.isFinite\(parsed\) \|\| parsed <= 0[\s\S]*?return null/.test(projection)],
  ['GHC ledger source remains server authoritative', /source: "ghc_transactions"[\s\S]*authority: "server_ledger"/.test(read('app/api/economy/wallet/summary/route.ts'))],
  ['read-only payment reconciliation summary is present', /const piReconciliation = useMemo/.test(wallet) && /Payment checks/.test(wallet)],
  ['reconciliation flags completed-but-unfulfilled intents', /normalize\(i\.status\) === "COMPLETED"/.test(wallet) && /Paid, fulfilment not confirmed/.test(wallet)],
  ['reconciliation flags paid records missing provider payment IDs', /paidMissingProviderId = piIntents\.filter/.test(wallet)],
  ['reconciliation warns that feature fulfilment is not verified', /Marketplace and membership have explicit record checks/.test(wallet) && /No records are changed by these checks/.test(wallet)],
  ['canonical Pi projection rejects non-object rows', /Array\.isArray\(value\)/.test(projection) && /if \(!raw\) return null/.test(projection)],
  ['canonical projection preserves unknown purpose identity', /Payment · \$\{key\.replace/.test(projection)],
  ['canonical projection never asserts settlement or fulfilment', /never asserts provider settlement or fulfilment/.test(projection)],
  ['reconciliation is explicitly read-only and user scoped', /read-only, user-scoped reconciliation/i.test(reconciliation) && /resolveAuthenticatedUser\(request\.headers\)/.test(reconciliation)],
  ['reconciliation bounds feature-store concurrency', /mapWithConcurrency\(intents, 5/.test(reconciliation)],
  ['marketplace reconciliation checks buyer ownership and linked identifiers', /order\.buyerId !== auth\.userId/.test(reconciliation) && /MARKETPLACE_PAYMENT_LINK_MISMATCH/.test(reconciliation)],
  ['membership reconciliation requires durable authoritative entitlement', /loaded\.source !== "db"/.test(reconciliation) && /MEMBERSHIP_STORE_NOT_AUTHORITATIVE/.test(reconciliation)],
  ['reconciliation does not mutate financial records', /Never mutates payments, orders, entitlements, balances, or fulfilment state/.test(reconciliation)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 9 wallet transaction integration: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
