#!/usr/bin/env node
/** Phase 11 wallet cross-feature reconciliation contracts; network/DB independent. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const route = read('app/api/payments/reconciliation/route.ts')
const wallet = read('features/wallet/wallet-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const checks = [
  ['release/package/lock versions agree', /^0\.10[0-9]\.0$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['phase report exists', fs.existsSync(path.join(process.cwd(), 'PHASE-11-WALLET-CROSS-FEATURE-RECONCILIATION.md'))],
  ['reconciliation endpoint authenticates request', /resolveAuthenticatedUser\(request\.headers\)/.test(route)],
  ['payment intents are scoped to authenticated user', /listIntentsForUserAsync\(auth\.userId\)/.test(route)],
  ['endpoint is GET-only and read-only', /export async function GET/.test(route) && /readOnly: true/.test(route) && !/export async function (POST|PUT|PATCH|DELETE)/.test(route)],
  ['responses disable caching', /Cache-Control.*no-store/.test(route)],
  ['marketplace mapping checks durable store first', /marketplaceOrdersDurable\(\)/.test(route) && /loadOrder\(intent\.referenceId\)/.test(route)],
  ['marketplace order owner is verified', /order\.buyerId !== auth\.userId/.test(route)],
  ['marketplace payment identifiers must match', /order\.paymentIntentId === intent\.id/.test(route) && /order\.paymentId === intent\.providerPaymentId/.test(route)],
  ['marketplace completion requires verified PI and completed order', /order.paymentMethod === "pi"/.test(route) && /\["verified"\]\.includes\(order.paymentStatus\)/.test(route) && /\["completed"\]\.includes\(order.status\)/.test(route)],
  ['membership mapping requires authoritative DB source', /tryGetEntitlementAuthoritative\(auth\.userId\)/.test(route) && /loaded\.source !== "db"/.test(route)],
  ['membership mapping matches payment intent or purchase reference', /entitlement\.paymentIntentId === intent\.id/.test(route) && /entitlement\.purchaseRef === intent\.referenceId/.test(route)],
  ['unknown feature mappings are explicitly unverified', /FEATURE_MAPPING_NOT_IMPLEMENTED/.test(route) && /reconciliation: "unverified"/.test(route)],
  ['no financial or fulfilment writes in reconciliation route', !/markIntentFulfilled|transitionIntent|grantEntitlement|saveOrder|updateCommerceOrder|fetch\([^\n]*method:\s*["'](POST|PUT|PATCH|DELETE)/.test(route)],
  ['wallet calls server reconciliation endpoint', /fetch\("\/api\/payments\/reconciliation"/.test(wallet)],
  ['wallet displays matched, attention and unverified counts', ['counts.matched','counts.attention_required','counts.unverified'].every(x => wallet.includes(x))],
  ['wallet surfaces server reconciliation findings', /aria-label="Reconciliation findings"/.test(wallet) && /f\.message/.test(wallet)],
  ['GHC rail is not merged into Pi reconciliation', /Pi payment intents/.test(wallet) && /GHC ledger transfers/.test(wallet)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 11 wallet cross-feature reconciliation: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
