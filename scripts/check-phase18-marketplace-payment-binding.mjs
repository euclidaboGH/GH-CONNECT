#!/usr/bin/env node
/** Phase 18: marketplace PI payment evidence must be server-authoritative. */
import fs from 'node:fs'
const route = fs.readFileSync('app/api/marketplace/orders/[orderId]/pay/route.ts', 'utf8')
const feeSettlement = fs.readFileSync('lib/server/fees/settle-pilot-fee.ts', 'utf8')
const checks = [
  ['marketplace payment requires authenticated buyer identity', /resolveAuthenticatedUser\(request\.headers\)/.test(route) && /order\.buyerId !== auth\.userId/.test(route)],
  ['payment intent must belong to the Pi provider', /intent\.provider !== "pi"/.test(route)],
  ['payment intent must be denominated in PI', /intent\.currency !== "PI"/.test(route)],
  ['payment intent purpose is bound to marketplace', /intent\.purpose !== "marketplace"/.test(route)],
  ['payment intent reference is bound to this order', /market_order_\$\{order\.id\}/.test(route)],
  ['payment amount is finite and compared with authoritative order total', /Number\.isFinite\(intent\.amount\)/.test(route) && /Math\.abs\(intent\.amount - order\.totalAmount\)/.test(route)],
  ['client-supplied payment IDs are never accepted as proof', /order\.paymentId = intent\.providerPaymentId \|\| undefined/.test(route) && /order\.txid = intent\.txid \|\| undefined/.test(route) && !/intent\.providerPaymentId \|\| paymentId/.test(route) && !/intent\.txid \|\| txid/.test(route)],
  ['currency validation uses normalized durable order currency', /orderCurrency !== "PI"/.test(route) && /method !== orderCurrency\.toLowerCase\(\)/.test(route)],
  ['verified-payment recovery remains idempotent', /PAYMENT_VERIFIED_RECONCILIATION_REQUIRED/.test(route) && /recordPlatformCommission/.test(route)],
  ['GHC spend remains server-authoritative and reference-idempotent', /ghc_execute_spend/.test(route) && /market_order_\$\{order\.id\}/.test(route)],
  ['ambiguous GHC spend does not release inventory claim', /if \(spendError === "INSUFFICIENT_BALANCE"\)/.test(route)],
  ['order transition persistence failure remains retryable', /ORDER_PERSIST_FAILED/.test(route) && /ORDER_STATE_RECONCILIATION_PENDING/.test(route)],
  ['payment responses are not cached', /Cache-Control": "no-store"/.test(route)],
  ['community PI fee requires authoritative Pi provider and PI currency', /intent\.provider !== "pi"/.test(feeSettlement) && /intent\.currency \\|\| ""/.test(feeSettlement)],
  ['community PI fee is bound to its dedicated intent purpose metadata', /intent\.purpose !== "other"/.test(feeSettlement) && /metadata\?\.kind\s*\|\|\s*""/.test(feeSettlement)],
  ['community PI fee requires exact order reference or explicit matching entity binding', /referenceMatches/.test(feeSettlement) && /metadataBindingMatches/.test(feeSettlement) && /!referenceMatches && !metadataBindingMatches/.test(feeSettlement)],
  ['community PI fee no longer defaults missing currency or empty reference to trusted values', !/metadata\?\.currency \|\| "PI"/.test(feeSettlement) && !/if \(input\.referenceId && refId && refId !== input\.referenceId\)/.test(feeSettlement)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 18 marketplace payment binding: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
