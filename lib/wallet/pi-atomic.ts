/**
 * Pure PI atomic-unit arithmetic shared by server ledger adapters and tests.
 * PI uses 7 decimal places; callers must keep the authoritative balance in the database.
 */
export const PI_ATOMIC_SCALE = 10_000_000

export function isValidPiAtomic(value: unknown, allowZero = false): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && (allowZero ? value >= 0 : value > 0)
}

export function piToAtomic(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const atomic = Math.round(amount * PI_ATOMIC_SCALE)
  return Number.isSafeInteger(atomic) && atomic > 0 ? atomic : 0
}

export function atomicToPi(atomic: number | string): number {
  if (typeof atomic === "string" && !/^\d{1,16}$/.test(atomic)) return 0
  const n = typeof atomic === "string" ? Number(atomic) : atomic
  if (!isValidPiAtomic(n, true)) return 0
  return n / PI_ATOMIC_SCALE
}

/** Floor PI decimal to integer atomic units; never rounds a balance upward. */
export function floorPiToAtomic(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const atomic = Math.floor(amount * PI_ATOMIC_SCALE + 1e-12)
  return Number.isSafeInteger(atomic) && atomic > 0 ? atomic : 0
}

/** Fee preview only; database quote remains authoritative. */
export function previewWithdrawalFeeAtomic(grossAtomic: number, feeBps = 300): {
  grossAtomic: number
  feeAtomic: number
  netAtomic: number
} {
  if (!isValidPiAtomic(grossAtomic) || !Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    return { grossAtomic: 0, feeAtomic: 0, netAtomic: 0 }
  }
  const feeBig = (BigInt(grossAtomic) * BigInt(feeBps) + 9_999n) / 10_000n
  const fee = Number(feeBig)
  const safeFee = Math.min(fee, Math.max(0, grossAtomic - 1))
  return { grossAtomic, feeAtomic: safeFee, netAtomic: grossAtomic - safeFee }
}
