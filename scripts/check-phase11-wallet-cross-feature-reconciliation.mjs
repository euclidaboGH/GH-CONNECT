#!/usr/bin/env node
/** Phase 11 wallet cross-feature reconciliation contracts; network/DB independent. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const route = read('app/api/payments/reconciliation/route.ts')
const intentStore = read('lib/server/payments/intent-store.ts')
const wallet = read('features/wallet/wallet-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const checks = [
  ['release/package/lock versions agree', /^\d+\.\d+\.\d+$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['phase report exists', fs.existsSync(path.join(process.cwd(), 'docs/archive/phase-notes/PHASE-11-WALLET-CROSS-FEATURE-RECONCILIATION.md'))],
  ['reconciliation endpoint authenticates request', /resolveAuthenticatedUser\(request\.headers\)/.test(route)],
  ['payment intents are scoped to authenticated user', /listIntentsForUserAsync\(auth\.userId\)/.test(route)],
  ['endpoint is GET-only and read-only', /export async function GET/.test(route) && /readOnly: true/.test(route) && !/export async function (POST|PUT|PATCH|DELETE)/.test(route)],
  ['responses disable caching', /Cache-Control.*no-store/.test(route)],
  ['marketplace mapping checks durable store first', /marketplaceOrdersDurable\(\)/.test(route) && /loadOrder\(orderId\)/.test(route)],
  ['marketplace order owner is verified', /order\.buyerId !== auth\.userId/.test(route)],
  ['marketplace references resolve canonical and explicitly prefixed order IDs safely', /startsWith\("market_order_"\)/.test(route) && /slice\("market_order_"\.length\)/.test(route) && /MARKETPLACE_REFERENCE_MISMATCH/.test(route)],
  ['marketplace payment identifiers must match', /order\.paymentIntentId === intent\.id/.test(route) && /order\.paymentId === intent\.providerPaymentId/.test(route)],
  ['marketplace completion requires verified PI and completed order', /order\.paymentMethod === "pi"/.test(route) && /order\.paymentStatus === "verified"/.test(route) && /order\.status === "completed"/.test(route)],
  ['membership mapping requires authoritative DB source', /tryGetEntitlementAuthoritative\(auth\.userId\)/.test(route) && /loaded\.source !== "db"/.test(route)],
  ['membership mapping matches payment intent or purchase reference', /linkedByIntent/.test(route) && /linkedByPurchase/.test(route)],
  ['unknown feature mappings are explicitly unverified', /FEATURE_MAPPING_NOT_IMPLEMENTED/.test(route) && /reconciliation: "unverified"/.test(route)],
  ['no financial or fulfilment writes in reconciliation route', !/markIntentFulfilled|transitionIntent|grantEntitlement|saveOrder|updateCommerceOrder|fetch\([^\n]*method:\s*["'](POST|PUT|PATCH|DELETE)/.test(route)],
  ['wallet calls server reconciliation endpoint', /fetch\("\/api\/payments\/reconciliation"/.test(wallet)],
  ['wallet displays matched, attention and unverified counts', ['counts.matched','counts.attention_required','counts.unverified'].every(x => wallet.includes(x))],
  ['wallet surfaces server reconciliation findings', /aria-label="Reconciliation findings"/.test(wallet) && /f\.message/.test(wallet)],
  ['GHC rail is not merged into Pi reconciliation', /Pi payment intents/.test(wallet) && /GHC ledger transfers/.test(wallet)],
  ['reconciliation discloses the 100-record coverage limit', /potentiallyTruncated/.test(route) && /recordLimit: historyLimit/.test(route)],
  ['wallet warns that capped results may not be lifetime-complete', /potentiallyTruncated/.test(wallet) && /not a complete lifetime reconciliation/.test(wallet)],
  ['history limit is shared with the authoritative payment-intent store', /PAYMENT_INTENT_HISTORY_LIMIT/.test(intentStore) && /params\.set\("limit", String\(PAYMENT_INTENT_HISTORY_LIMIT\)\)/.test(intentStore) && /historyLimit = PAYMENT_INTENT_HISTORY_LIMIT/.test(route)],
  ['reconciliation rechecks user ownership in the returned intent collection', /intent\.userId === auth\.userId && intent\.provider === "pi"/.test(route)],
  ['conflicting payment intent and provider identifiers are not masked by one match', /MARKETPLACE_PAYMENT_LINK_CONFLICT/.test(route) && /intentLinkConflicts/.test(route) && /providerLinkConflicts/.test(route)],
  ['marketplace matching verifies positive finite amount equality', /MARKETPLACE_AMOUNT_MISMATCH/.test(route) && /Number\.isFinite\(orderAmount\)/.test(route) && /Math\.abs\(orderAmount - intentAmount\) <= 0\.001/.test(route)],
  ['marketplace matching verifies PI payment method and currency', /MARKETPLACE_RAIL_MISMATCH/.test(route) && /order\.paymentMethod === "pi"/.test(route) && /String\(order\.currency\)\.toUpperCase\(\) === "PI"/.test(route)],
  ['refund status requires authoritative refunded order and payment states', /MARKETPLACE_REFUND_STATE_MISMATCH/.test(route) && /order\.paymentStatus === "refunded" && order\.status === "refunded"/.test(route)],
  ['failed and cancelled payments have distinct state-consistency checks', /MARKETPLACE_FAILED_PAYMENT_CONFLICT/.test(route) && /MARKETPLACE_CANCELLED_PAYMENT_CONFLICT/.test(route)],
  ['membership mapping avoids reusable referenceId false matches', /linkedByIntent/.test(route) && /linkedByPurchase/.test(route) && !/entitlement\.purchaseRef === intent\.referenceId/.test(route)],
  ['coverage discloses returned and reconciled record counts', /returnedIntentCount: allUserIntents\.length/.test(route) && /reconciledPiIntentCount: intents\.length/.test(route)],
  ['current phase 11 report documents v0.157.11 controls', /v0\.157\.11/.test(read('docs/PHASE-11-WALLET-CROSS-FEATURE-RECONCILIATION.md')) && /conflict|contradictory/.test(read('docs/PHASE-11-WALLET-CROSS-FEATURE-RECONCILIATION.md'))],
  ['phase 11 check is registered in npm scripts', pkg.scripts?.['check:phase11-wallet-reconciliation'] === 'node scripts/check-phase11-wallet-cross-feature-reconciliation.mjs'],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 11 wallet cross-feature reconciliation: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
