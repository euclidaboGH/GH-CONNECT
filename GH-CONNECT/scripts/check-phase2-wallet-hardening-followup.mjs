#!/usr/bin/env node
/** Phase 2 wallet hardening regression gate. Static checks are not runtime settlement proof. */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const read = (path) => readFileSync(path, "utf8")
const walletScreen = read("features/wallet/wallet-screen.tsx")
const walletHistory = read("app/api/economy/wallet/[userId]/route.ts")
const walletSummary = read("app/api/economy/wallet/summary/route.ts")
const withdrawals = read("app/api/economy/withdrawals/route.ts")
const walletAuth = read("app/api/identity/wallet-authorization/route.ts")
const paymentComplete = read("app/api/payments/complete/route.ts")
const walletReadProvider = read("contexts/domains/wallet-read-provider.tsx")
const csv = read("features/wallet/wallet-csv.ts")
const checks = [
  ["wallet history endpoint uses durable fail-closed rate limiting", walletHistory.includes('checkDurableRateLimit(`wallet-history:${auth.userId}`') && walletHistory.includes('onUnavailable: "deny"')],
  ["wallet summary endpoint uses durable fail-closed rate limiting", walletSummary.includes('checkDurableRateLimit(`wallet-summary:${auth.userId}`') && walletSummary.includes('onUnavailable: "deny"')],
  ["wallet summary catches upstream exceptions", /try \{\s*result = await socialRpc/.test(walletSummary) && walletSummary.includes('error: "WALLET_UNAVAILABLE"')],
  ["wallet summary rejects non-object RPC payloads", walletSummary.includes('Array.isArray(result.data)')],
  ["withdrawal quote/history reads are durably rate limited", withdrawals.includes('ghc-withdrawal-read:${auth.userId}') && withdrawals.includes('onUnavailable: "deny"')],
  ["withdrawal creation is durably rate limited", withdrawals.includes('ghc-withdrawal-create:${auth.userId}') && withdrawals.includes('onUnavailable: "deny"')],
  ["wallet authorization status uses durable rate limiting", walletAuth.includes('wallet-auth-get:${auth.userId}') && walletAuth.includes('checkDurableRateLimit')],
  ["wallet authorization grant uses durable rate limiting", walletAuth.includes('wallet-auth-grant:${auth.userId}') && walletAuth.includes('checkDurableRateLimit')],
  ["wallet authorization revoke uses durable rate limiting", walletAuth.includes('wallet-auth-revoke:${auth.userId}') && walletAuth.includes('checkDurableRateLimit')],
  ["Pi payment completion is durably rate limited", paymentComplete.includes('pi-payment-complete:${auth.userId}') && paymentComplete.includes('onUnavailable: "deny"')],
  ["every Pi completion response is private and non-cacheable", paymentComplete.includes('const NO_STORE = { "Cache-Control": "private, no-store, max-age=0"') && paymentComplete.includes('return NextResponse.json(body, { ...init, headers })')],
  ["economy policy request has an eight-second abort deadline", walletScreen.includes('controller.abort(), 8_000')],
  ["economy policy payload validates fixed spend catalog", walletScreen.includes('policy.fixedSpendCatalog.every')],
  ["matured reward claim request is time bounded", walletScreen.includes('maturedController.abort(), 8_000')],
  ["authoritative wallet refresh is single-flight", walletScreen.includes('walletAuthorityRefreshInFlight.current')],
  ["Pi payment history uses a bounded abortable request", walletScreen.includes('controller.abort(), 12_000') && walletScreen.includes('signal: controller.signal')],
  ["Pi reconciliation counters are validated as non-negative safe integers", walletScreen.includes('Number.isSafeInteger(counts[key])') && walletScreen.includes('counts[key] >= 0')],
  ["stale reconciliation findings are cleared before reload", walletScreen.includes('setServerReconciliation(null)')],
  ["reward claim request is bounded and no detached timer unlocks it", walletScreen.includes('claimController.abort(), 30_000') && !walletScreen.includes('setClaimingHoldId((cur) => (cur === holdId ? null : cur))')],
  ["wallet CSV uses quoting and formula neutralization", csv.includes('text.replace(/"/g, \'""\')') && csv.includes('typeof value === "string"')],
  ["CSV object URLs are revoked after browser download consumption", walletScreen.includes('URL.revokeObjectURL(url), 1_000')],
  ["transfer history rows reject invalid status, amount and timestamp", walletHistory.includes('Number.isFinite(item.amount) && item.amount > 0') && walletHistory.includes('Number.isFinite(item.createdAt)')],
  ["wallet snapshot polling skips hidden/offline tabs", walletReadProvider.includes('document.visibilityState === "visible" && navigator.onLine')],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failures += 1
}
console.log(`Phase 2 wallet hardening: ${checks.length - failures}/${checks.length} passed`)
assert.equal(failures, 0)
