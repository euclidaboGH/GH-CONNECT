/**
 * PI amount helpers (display + input only). The earnings ledger stays the sole
 * authority; these never mutate balances. 1 PI = 10_000_000 atomic units.
 * Integer/string math only — no float rounding on user input.
 */
export const PI_ATOMIC_SCALE = 10_000_000
export const PI_DECIMALS = 7

export type PiInputResult =
  | { ok: true; atomic: number }
  | { ok: false; code: "EMPTY" | "INVALID" | "TOO_MANY_DECIMALS" | "TOO_LARGE" | "NOT_POSITIVE" }

/** Parse a typed PI amount exactly (no exponent, no sign, max 7 decimals). */
export function parsePiInput(raw: string): PiInputResult {
  const s = String(raw ?? "").trim().replace(/,/g, "")
  if (!s) return { ok: false, code: "EMPTY" }
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return { ok: false, code: "INVALID" }
  const [whole = "", frac = ""] = s.split(".")
  if (frac.length > PI_DECIMALS) return { ok: false, code: "TOO_MANY_DECIMALS" }
  const atomicStr = `${whole || "0"}${frac.padEnd(PI_DECIMALS, "0")}`.replace(/^0+(?=\d)/, "")
  const atomic = Number(atomicStr)
  if (!Number.isSafeInteger(atomic)) return { ok: false, code: "TOO_LARGE" }
  if (atomic <= 0) return { ok: false, code: "NOT_POSITIVE" }
  return { ok: true, atomic }
}

export function atomicToPiString(atomic: number): string {
  if (!Number.isFinite(atomic) || atomic < 0) return "0"
  const n = Math.floor(atomic)
  const whole = Math.floor(n / PI_ATOMIC_SCALE)
  const frac = String(n % PI_ATOMIC_SCALE).padStart(PI_DECIMALS, "0").replace(/0+$/, "")
  return frac ? `${whole}.${frac}` : String(whole)
}

/** Floor PI to atomic units; never rounds a balance up. */
export function floorPiToAtomic(pi: number): number {
  if (!Number.isFinite(pi) || pi <= 0) return 0
  return Math.floor(pi * PI_ATOMIC_SCALE + 1e-6)
}

export function formatPiAmount(pi: number): string {
  if (!Number.isFinite(pi)) return "—"
  return pi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: PI_DECIMALS })
}

/** Largest amount a user can request: never above available, never above the single-payout cap. */
export function maxWithdrawAtomic(availableAtomic: number, maxSingleAtomic?: number | null): number {
  const avail = Number.isFinite(availableAtomic) ? Math.max(0, Math.floor(availableAtomic)) : 0
  if (typeof maxSingleAtomic === "number" && Number.isFinite(maxSingleAtomic) && maxSingleAtomic > 0) {
    return Math.min(avail, Math.floor(maxSingleAtomic))
  }
  return avail
}

export function piInputMessage(code: Extract<PiInputResult, { ok: false }>["code"]): string {
  switch (code) {
    case "EMPTY": return "Enter the Pi amount to withdraw."
    case "TOO_MANY_DECIMALS": return `Pi supports at most ${PI_DECIMALS} decimal places.`
    case "TOO_LARGE": return "That amount is too large."
    case "NOT_POSITIVE": return "Amount must be greater than 0."
    default: return "Enter a valid Pi amount."
  }
}
