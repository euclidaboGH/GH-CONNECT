/**
 * Phase D7.1 — GHC Wallet UX helper tests (presentation only).
 * Run: npx tsx lib/domains/d7-1-wallet-ux-tests.ts
 */
import {
  mapGhcUxError,
  formatGhcAmount,
  activityDirection,
  activityTitle,
  requestStatusLabel,
  isRequestPayable,
  isSafeReceiveUri,
  maskBalanceText,
  EMPTY_STATES,
} from "./ghc-wallet-ux"

let passed = 0
let failed = 0
function assert(c: boolean, name: string) {
  if (c) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

console.log("\nGHC Phase D7.1 wallet UX tests\n")

assert(mapGhcUxError("INSUFFICIENT_BALANCE").title === "Insufficient balance", "insufficient title")
assert(/enough available GHC/i.test(mapGhcUxError("INSUFFICIENT_BALANCE").body), "insufficient body")
assert(mapGhcUxError("NETWORK_TIMEOUT").title === "Connection timed out", "timeout distinct from failed")
assert(!/sql|stack|supabase/i.test(mapGhcUxError("SQL EXCEPTION: select * from secrets").body), "no SQL leak")
assert(mapGhcUxError("SELF_TRANSFER").title === "Invalid recipient", "self transfer")
assert(mapGhcUxError("SERVER_UNAVAILABLE").title === "Unable to connect", "unavailable vs failed")

assert(formatGhcAmount(12.5) === "12.5" || formatGhcAmount(12.5).includes("12"), "format amount")
assert(formatGhcAmount(10, true) === "••••", "hidden amount")
assert(maskBalanceText(false, "100") === "••••", "mask balance")
assert(maskBalanceText(true, "100") === "100", "show balance")

assert(activityDirection("transfer_in", 10) === "in", "in direction")
assert(activityDirection("transfer_out", -10) === "out", "out direction")
assert(activityDirection("earned", 5, "pending") === "pending", "pending direction")
assert(activityTitle("transfer_out") === "Sent", "sent title")
assert(activityTitle("transfer_in") === "Received", "received title")

assert(requestStatusLabel("PENDING") === "Pending", "status pending")
assert(requestStatusLabel("ACCEPTED") === "Accepted", "status accepted")
assert(isRequestPayable("PENDING", Date.now() + 60_000) === true, "payable pending")
assert(isRequestPayable("PENDING", Date.now() - 1000) === false, "not payable expired")
assert(isRequestPayable("ACCEPTED", Date.now() + 60_000) === false, "not payable accepted")
assert(isRequestPayable("DECLINED") === false, "not payable declined")

assert(isSafeReceiveUri("ghc://receive?v=1&id=GH-A1B2C3") === true, "safe uri")
assert(isSafeReceiveUri("ghc://receive?v=1&id=GH-A1B2C3&amount=50") === false, "reject amount in uri")
assert(isSafeReceiveUri("ghc://receive?v=1&id=GH-A1B2C3&token=abc") === false, "reject token")
assert(isSafeReceiveUri("https://evil.com") === false, "reject http")

assert(!!EMPTY_STATES.activity.title, "empty activity")
assert(!!EMPTY_STATES.incomingRequests.body, "empty incoming")

console.log(`\nPhase D7.1 result: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exitCode = 1
