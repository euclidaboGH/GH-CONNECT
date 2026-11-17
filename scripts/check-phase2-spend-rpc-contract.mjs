import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const spend = readFileSync("app/api/economy/ledger/spend/route.ts", "utf8")
const marketplace = readFileSync("app/api/marketplace/orders/[orderId]/pay/route.ts", "utf8")
const store = readFileSync("lib/server/economy/store.ts", "utf8")
const helper = readFileSync("lib/server/economy/spend-rpc-contract.mjs", "utf8")
const restClient = readFileSync("lib/server/supabase/rest-client.ts", "utf8")
const checks = [
  ["shared GHC spend RPC contract parser exists", helper.includes("payload.ok !== true")],
  ["spend API validates RPC envelope before success", spend.includes("parseGhcSpendRpcResult(data, input)")],
  ["marketplace GHC payment validates RPC envelope before success", marketplace.includes("parseGhcSpendRpcResult(data, input)")],
  ["utility and premium durable spend validates RPC envelope", store.includes("parseGhcSpendRpcResult(data, { amount, referenceId: ref })")],
  ["all three durable spend paths use bounded request timeouts", spend.includes("AbortSignal.timeout(10_000)") && marketplace.includes("AbortSignal.timeout(10_000)") && store.includes("timeoutMs: 10_000") && /AbortSignal\.timeout\(options\.timeoutMs \?\? 15_000\)/.test(restClient)],
  ["all three durable spend paths disable HTTP caching", spend.includes('cache: "no-store"') && marketplace.includes('cache: "no-store"') && /cache:\s*"no-store"/.test(restClient)],
  ["success requires exact transaction reference", helper.includes("payload.referenceId !== expected.referenceId")],
  ["success requires amount equality at GHC precision", helper.includes("expectedAtomic === returnedAtomic") && helper.includes("Math.abs(expectedAmount * 10_000 - expectedAtomic) < 1e-7")],
  ["success requires explicit idempotency boolean and transaction ID", helper.includes("typeof payload.idempotent !== \"boolean\"") && helper.includes("if (!transactionId) return fail()")],
  ["ambiguous marketplace spend failures remain retryable and retain the payment claim", marketplace.includes('retryable: status === 503') && marketplace.includes('status === 503 ? "5" : "0"') && marketplace.includes('if (spendError === "INSUFFICIENT_BALANCE")')],
]
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
const failed = checks.filter(([, ok]) => !ok).length
console.log(`Phase 2 spend RPC contract: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
