/** Wallet display helpers. These values are presentation-only; never calculate authority here. */
export function formatAtomicDisplay(value: unknown, decimals = 6): string {
  // null / "" / booleans coerce to 0 with Number(); that would invent a zero balance.
  if (typeof value !== "number" && typeof value !== "string") return "—"
  if (typeof value === "string" && value.trim() === "") return "—"
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0) return "—"
  const d = Math.max(0, Math.min(12, Math.floor(decimals)))
  return (n / 10 ** d).toFixed(Math.min(d, 6))
}

export function spendableAmount(total: unknown, reserved: unknown): number {
  const a = Number(total)
  const b = Number(reserved)
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b < 0) return 0
  return Math.max(0, a - b)
}

export function withdrawalDisplayState(input: {
  available?: boolean
  consentRequired?: boolean
  pending?: boolean
  unavailableReason?: string
}): "ready" | "consent" | "pending" | "unavailable" {
  return input.pending
    ? "pending"
    : input.consentRequired
      ? "consent"
      : input.available
        ? "ready"
        : "unavailable"
}

export function normalizeLedgerCursor(value: unknown): string | null {
  const s = String(value ?? "").trim()
  return s.length > 0 && s.length <= 256 && /^[A-Za-z0-9._:-]+$/.test(s) ? s : null
}

export function walletAssetLabel(asset: unknown): "PI" | "GHC" | "Unknown asset" {
  const s = String(asset ?? "").toUpperCase()
  return s === "PI" ? "PI" : s === "GHC" ? "GHC" : "Unknown asset"
}

/** True when summary payload looks durable enough to render (never invent balances). */
export function isDurableWalletSummary(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false
  const row = raw as Record<string, unknown>
  const candidate = row.balance ?? row.available ?? row.spendable
  // Reject null/""/booleans: Number() would turn them into 0 and fabricate a balance.
  if (typeof candidate !== "number" && typeof candidate !== "string") return false
  if (typeof candidate === "string" && candidate.trim() === "") return false
  return Number.isFinite(Number(candidate))
}

export function dualRailAttention(flags: {
  pendingPi?: boolean
  reservedPi?: boolean
  pendingGhc?: boolean
  needsConsent?: boolean
}): number {
  let n = 0
  if (flags.pendingPi) n++
  if (flags.reservedPi) n++
  if (flags.pendingGhc) n++
  if (flags.needsConsent) n++
  return n
}
