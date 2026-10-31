/**
 * Server-side GHC amount validation.
 * Ledger uses numeric(18,4) — max 4 decimal places.
 * Never trust client floats without normalization.
 */

/** GHC scale matches Postgres numeric(18,4) */
export const GHC_DECIMAL_PLACES = 4
export const GHC_MAX_ABS = 1_000_000_000 // hard ceiling beyond product limits

export type AmountValidation =
  | { ok: true; amount: number }
  | { ok: false; code: string; message: string }

/**
 * Parse and validate a financial amount for GHC operations.
 * Rejects NaN, Infinity, negative, zero (for transfer/spend), excess precision.
 */
export function validatePositiveGhcAmount(
  raw: unknown,
  opts?: { min?: number; max?: number; allowZero?: boolean }
): AmountValidation {
  if (raw === null || raw === undefined) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount required" }
  }
  if (typeof raw === "string" && raw.trim() === "") {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount required" }
  }
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount must be a finite number" }
  }
  if (Object.is(n, -0)) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Invalid amount" }
  }
  if (n < 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount cannot be negative" }
  }
  if (!opts?.allowZero && n === 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount must be greater than 0" }
  }
  if (n > GHC_MAX_ABS) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount exceeds maximum" }
  }
  // Precision: at most 4 decimal places
  const scaled = Math.round(n * 10 ** GHC_DECIMAL_PLACES)
  const normalized = scaled / 10 ** GHC_DECIMAL_PLACES
  if (Math.abs(n - normalized) > 1e-9) {
    return {
      ok: false,
      code: "INVALID_AMOUNT",
      message: `Amount may have at most ${GHC_DECIMAL_PLACES} decimal places`,
    }
  }
  if (opts?.min != null && normalized < opts.min) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount below minimum" }
  }
  if (opts?.max != null && normalized > opts.max) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount exceeds limit" }
  }
  return { ok: true, amount: normalized }
}
