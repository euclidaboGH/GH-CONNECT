/** Pure Send GHC helpers (Phase D2) — no React */

export function parseGhcAmount(raw: string): number | null {
  const cleaned = String(raw || "").replace(/,/g, "").trim()
  if (!cleaned) return null
  if (!/^\d+(\.\d{0,4})?$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function buildTransferReference(
  senderHint: string,
  toUserId: string,
  amount: number
): string {
  const a = Math.round(amount * 10000) / 10000
  const salt = Math.random().toString(36).slice(2, 8)
  return `p2p_${senderHint || "user"}_${toUserId}_${a}_${Date.now().toString(36)}_${salt}`
}
