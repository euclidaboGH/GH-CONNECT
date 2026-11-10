/**
 * Validate the durable GHC spend RPC envelope before callers treat a debit as committed.
 * PostgREST transport success alone is not financial success.
 */
export function parseGhcSpendRpcResult(value, expected) {
  const fail = (error = "SPEND_RPC_INVALID_RESPONSE") => ({ ok: false, error })
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail()

  const payload = value
  if (payload.ok !== true) {
    const code = typeof payload.error === "string" && /^[A-Z0-9_]{1,64}$/.test(payload.error)
      ? payload.error
      : "SPEND_FAILED"
    return fail(code)
  }

  const expectedAmount = Number(expected?.amount)
  const returnedAmount = Number(payload.amount)
  const expectedAtomic = Math.round(expectedAmount * 10_000)
  const returnedAtomic = Math.round(returnedAmount * 10_000)
  const amountValid = Number.isFinite(expectedAmount) && expectedAmount > 0 &&
    Number.isFinite(returnedAmount) && returnedAmount > 0 &&
    Math.abs(expectedAmount * 10_000 - expectedAtomic) < 1e-7 &&
    Math.abs(returnedAmount * 10_000 - returnedAtomic) < 1e-7 &&
    expectedAtomic === returnedAtomic
  if (!amountValid) return fail()
  if (typeof expected?.referenceId !== "string" || !expected.referenceId || payload.referenceId !== expected.referenceId) {
    return fail()
  }
  if (typeof payload.idempotent !== "boolean") return fail()

  const transactionId = typeof payload.transactionId === "string" && payload.transactionId.trim()
    ? payload.transactionId.trim()
    : ""
  if (!transactionId) return fail()

  let tx = null
  if (payload.tx !== undefined && payload.tx !== null) {
    if (typeof payload.tx !== "object" || Array.isArray(payload.tx)) return fail()
    if (typeof payload.tx.id !== "string" || payload.tx.id !== transactionId) return fail()
    if (payload.tx.referenceId !== undefined && payload.tx.referenceId !== expected.referenceId) return fail()
    tx = payload.tx
  } else {
    tx = { id: transactionId, referenceId: expected.referenceId }
  }

  return { ok: true, idempotent: payload.idempotent, transactionId, tx, amount: returnedAmount }
}
