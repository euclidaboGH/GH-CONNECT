/**
 * Section 2 — Wallet & Payments essential controls (0.338.15)
 * Presentation-only helpers; financial authority remains server-side.
 */

export const PI_ATOMIC_SCALE = 10_000_000
export const GHC_DECIMAL_PLACES = 4

/** Never display non-finite or negative server amounts as confirmed balances. */
export function sanitizeDisplayAmount(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Pi atomic units → display string without float drift (floor). */
export function formatPiAtomic(atomic: unknown): string | null {
  const a = typeof atomic === "number" ? atomic : Number(atomic)
  if (!Number.isSafeInteger(a) || a < 0) return null
  const whole = Math.floor(a / PI_ATOMIC_SCALE)
  const frac = String(a % PI_ATOMIC_SCALE).padStart(7, "0").replace(/0+$/, "")
  return frac ? `${whole}.${frac}` : String(whole)
}

/** Labels that must never merge Pi and GHC into one total. */
export const WALLET_RAIL_LABELS = {
  pi: "Pi balance",
  ghc: "GHC balance",
  reserved: "Reserved (not withdrawable yet)",
  pending: "Pending (not spendable yet)",
} as const

export function isSecretBearingWalletField(key: string): boolean {
  return /(pin|secret|token|mnemonic|private|authorization|password)/i.test(String(key || ""))
}
