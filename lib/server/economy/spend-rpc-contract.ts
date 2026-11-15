/**
 * Typed wrapper around the pure JS spend RPC contract so TypeScript can narrow
 * success vs failure without relying on .mjs inference.
 */
// Pure JS contract module (no types emitted).
import { parseGhcSpendRpcResult as parseRaw } from "./spend-rpc-contract.mjs"

export type GhcSpendRpcFailure = { ok: false; error: string }
export type GhcSpendRpcSuccess = {
  ok: true
  idempotent: boolean
  transactionId: string
  tx: unknown
  amount: number
}
export type GhcSpendRpcResult = GhcSpendRpcFailure | GhcSpendRpcSuccess

export function parseGhcSpendRpcResult(
  value: unknown,
  expected: { amount?: number; referenceId?: string } | null | undefined
): GhcSpendRpcResult {
  const result = parseRaw(value, expected) as GhcSpendRpcResult
  if (!result || typeof result !== "object") {
    return { ok: false, error: "SPEND_RPC_INVALID_RESPONSE" }
  }
  if (result.ok !== true) {
    return { ok: false, error: typeof (result as GhcSpendRpcFailure).error === "string" ? (result as GhcSpendRpcFailure).error : "SPEND_FAILED" }
  }
  return result
}
