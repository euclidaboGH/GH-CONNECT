import assert from "node:assert/strict"
import { parseGhcSpendRpcResult } from "../lib/server/economy/spend-rpc-contract.mjs"

const expected = { amount: 12.5, referenceId: "market_order_123" }
const valid = {
  ok: true,
  idempotent: false,
  transactionId: "tx-123",
  referenceId: expected.referenceId,
  amount: expected.amount,
}

assert.deepEqual(parseGhcSpendRpcResult(valid, expected), {
  ok: true,
  idempotent: false,
  transactionId: "tx-123",
  tx: { id: "tx-123", referenceId: expected.referenceId },
  amount: expected.amount,
})
assert.equal(parseGhcSpendRpcResult({ ...valid, idempotent: true }, expected).ok, true)
assert.equal(parseGhcSpendRpcResult({ ...valid, ok: false, error: "INSUFFICIENT_BALANCE" }, expected).error, "INSUFFICIENT_BALANCE")
assert.equal(parseGhcSpendRpcResult({ ...valid, ok: undefined }, expected).ok, false)
assert.equal(parseGhcSpendRpcResult({}, expected).ok, false)
assert.equal(parseGhcSpendRpcResult({ ...valid, referenceId: "another-order" }, expected).ok, false)
assert.equal(parseGhcSpendRpcResult({ ...valid, amount: 12.49 }, expected).ok, false)
assert.equal(parseGhcSpendRpcResult({ ...valid, amount: 12.50009 }, expected).ok, false)
assert.equal(parseGhcSpendRpcResult({ ...valid, transactionId: "" }, expected).ok, false)
assert.equal(parseGhcSpendRpcResult({ ...valid, idempotent: "false" }, expected).ok, false)
assert.equal(parseGhcSpendRpcResult({ ...valid, tx: { id: "different-id" } }, expected).ok, false)
assert.equal(parseGhcSpendRpcResult(null, expected).ok, false)
assert.equal(parseGhcSpendRpcResult([], expected).ok, false)
console.log("GHC spend RPC contract: 13/13 passed")
