/**
 * GHC amount helpers (display + input only). The ledger is numeric(18,4); the
 * server stays authoritative. Integer "units" = GHC x 10_000 so no float drift.
 */
export const GHC_UNIT_SCALE = 10_000
export const GHC_INPUT_DECIMALS = 4

export type GhcInputResult =
  | { ok: true; units: number; amount: number }
  | { ok: false; code: "EMPTY" | "INVALID" | "TOO_MANY_DECIMALS" | "TOO_LARGE" | "NOT_POSITIVE" }

export function parseGhcInput(raw: string): GhcInputResult {
  const s = String(raw ?? "").trim().replace(/,/g, "")
  if (!s) return { ok: false, code: "EMPTY" }
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return { ok: false, code: "INVALID" }
  const [whole = "", frac = ""] = s.split(".")
  if (frac.length > GHC_INPUT_DECIMALS) return { ok: false, code: "TOO_MANY_DECIMALS" }
  const unitsStr = `${whole || "0"}${frac.padEnd(GHC_INPUT_DECIMALS, "0")}`.replace(/^0+(?=\d)/, "")
  const units = Number(unitsStr)
  if (!Number.isSafeInteger(units) || units > 1_000_000_000 * GHC_UNIT_SCALE) return { ok: false, code: "TOO_LARGE" }
  if (units <= 0) return { ok: false, code: "NOT_POSITIVE" }
  return { ok: true, units, amount: units / GHC_UNIT_SCALE }
}

export function ghcInputMessage(code: Extract<GhcInputResult, { ok: false }>["code"]): string {
  switch (code) {
    case "EMPTY": return "Enter a GHC amount."
    case "TOO_MANY_DECIMALS": return `GHC supports at most ${GHC_INPUT_DECIMALS} decimal places.`
    case "TOO_LARGE": return "That amount is too large."
    case "NOT_POSITIVE": return "Amount must be greater than 0."
    default: return "Enter a valid GHC amount."
  }
}

/** Floor to 4 dp so a "Max" button can never exceed the balance. */
export function floorGhc(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.floor(amount * GHC_UNIT_SCALE + 1e-6) / GHC_UNIT_SCALE
}

/** Indicative PI value for a GHC amount at a server-quoted rate; floored, never rounded up. */
export function ghcToPiPreview(ghc: number, ghcPerPi: number): number {
  if (!Number.isFinite(ghc) || !Number.isFinite(ghcPerPi) || ghc <= 0 || ghcPerPi <= 0) return 0
  return Math.floor((ghc / ghcPerPi) * 1e7 + 1e-6) / 1e7
}

/** Pi wallet addresses are 56-char Stellar public keys (G + base32). Shape check only. */
export function looksLikePiWalletAddress(raw: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(String(raw ?? "").trim())
}

export function formatGhcSafe(n: number, opts?: { signed?: boolean }): string {
  if (!Number.isFinite(n)) return "₲ 0.00"
  const abs = Math.abs(n) < 0.005 ? 0 : Math.abs(n)
  const body = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = opts?.signed ? (n > 0 && abs > 0 ? "+" : n < 0 && abs > 0 ? "−" : "") : n < 0 && abs > 0 ? "−" : ""
  return `${sign}₲ ${body}`
}

const WITHDRAWAL_STATUS: Record<string, string> = {
  pending: "Awaiting review", requested: "Awaiting review", approved: "Approved",
  processing: "Processing", settled: "Settled", completed: "Settled",
  rejected: "Declined", failed: "Failed", cancelled: "Cancelled", canceled: "Cancelled",
}
export function withdrawalStatusLabel(status: string): string {
  const k = String(status || "").toLowerCase()
  return WITHDRAWAL_STATUS[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : "Pending")
}
