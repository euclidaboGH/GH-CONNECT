#!/usr/bin/env node
/** Run #256: ensure earnings A2U blockers are visible and never bypass Pi's single incomplete-payment lane. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const route = readFileSync('app/api/economy/earnings/withdrawals/execute/route.ts', 'utf8')
const ui = readFileSync('components/ghc/pi-withdraw-sheet.tsx', 'utf8')
const orchestration = readFileSync('lib/server/payments/a2u-orchestration.ts', 'utf8')
const treasury = readFileSync('app/api/admin/treasury/summary/route.ts', 'utf8')
const checks = [
  ['earnings executor writes unrelated A2U blockers to the shared review queue', /enqueueA2uReview/.test(route) && /UNRELATED_INCOMPLETE_A2U_PAYMENT/.test(route)],
  ['blocker provider payment ID and txid are preserved for operator reconciliation', /providerPaymentId:blockerId\|\|undefined/.test(route) && /txid:blockerTxid\|\|undefined/.test(route)],
  ['blocker metadata is reduced to bounded domain/request diagnostics', /blockerDomain/.test(route) && /blockerRequest/.test(route) && /\.slice\(0,64\)/.test(route) && /\.slice\(0,80\)/.test(route)],
  ['an unrelated incomplete A2U is never automatically cancelled or submitted', /UNRELATED_INCOMPLETE_A2U_REQUIRES_OPERATOR_REVIEW/.test(route) && !/sdk\.cancelPayment\(/.test(route)],
  ['earnings request stays uncertain and the durable review is queued before returning', /failureCode="UNRELATED_INCOMPLETE_A2U_PAYMENT"/.test(route) && /reviewQueued:queued\.ok/.test(route)],
  ['actual sanitized failure code is persisted when execution ends', /p_failure_code:failureCode/.test(route)],
  ['raw provider exception messages are not returned to the browser', /diagnosticCode:failureCode/.test(route) && !/detail:error instanceof Error\?error\.message/.test(route)],
  ['operator queue records payment ID, txid and bounded detail', /providerPaymentId\?: string/.test(orchestration) && /txid\?: string/.test(orchestration) && /p_detail: input\.detail/.test(orchestration)],
  ['operator-only treasury summary can inspect Pi incomplete server payments read-only', /inspectPiIncompleteServerPayments/.test(orchestration) && /getPiIncompleteA2uPayments/.test(orchestration) && /piProviderIncomplete: providerIncomplete/.test(treasury)],
  ['provider inspection never auto-submits, cancels or completes payments', /Read-only Testnet inspection/.test(orchestration) && !/sdk\.(?:submitPayment|cancelPayment|completePayment)\(/.test(orchestration.slice(orchestration.indexOf('export async function inspectPiIncompleteServerPayments')))],
  ['wallet explains that another incomplete A2U payment must be reconciled', /UNRELATED_INCOMPLETE_A2U_REQUIRES_OPERATOR_REVIEW/.test(ui) && /no duplicate transfer was created/i.test(ui)],
  ['wallet diagnostic action label uses safe nested quoting', /use 'Check for releasable requests' to return it/.test(ui)],
  ['user-visible success still requires verified Pi settlement', /status === "paid"/.test(ui) && /Withdrawal complete\. Your Pi has been sent/.test(ui)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nRun #256 earnings A2U review queue: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
