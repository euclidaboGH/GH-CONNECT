/**
 * Cryptographically strong ID helpers (Phase 2).
 * Prefer these over Math.random() for any identifier that is:
 * - persisted
 * - used as a capability or correlation handle
 * - visible across trust boundaries
 */

/** RFC 4122 UUID v4 via Web Crypto / node:crypto. */
export function secureUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Node fallback when global crypto.randomUUID is unavailable
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUUID } = require("node:crypto") as typeof import("node:crypto")
    return randomUUID()
  } catch {
    const bytes = new Uint8Array(16)
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes)
    } else {
      throw new Error("SECURE_RANDOM_UNAVAILABLE")
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
}

/** Prefixed opaque ID: `${prefix}_${uuid}` */
export function securePrefixedId(prefix: string): string {
  const clean = String(prefix || "id").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "id"
  return `${clean}_${secureUUID()}`
}

/** Hex string of n random bytes (default 16 → 32 hex chars). */
export function secureHex(bytes = 16): string {
  const n = Math.max(1, Math.min(64, bytes | 0))
  const arr = new Uint8Array(n)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { randomBytes } = require("node:crypto") as typeof import("node:crypto")
      const buf = randomBytes(n)
      return buf.toString("hex")
    } catch {
      throw new Error("SECURE_RANDOM_UNAVAILABLE")
    }
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
}
