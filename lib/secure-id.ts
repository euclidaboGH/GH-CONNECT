/**
 * Cryptographically strong ID helpers for browser and Node runtimes.
 *
 * Keep this module browser-safe: it is imported by shared application code.
 * Node 24.15 and supported browsers expose Web Crypto through globalThis.crypto.
 * If a secure source is unavailable, fail closed rather than falling back to
 * Math.random() or pulling Node-only modules into the client bundle.
 */
function secureCrypto(): Crypto {
  const provider = globalThis.crypto
  if (!provider || typeof provider.getRandomValues !== "function") {
    throw new Error("SECURE_RANDOM_UNAVAILABLE")
  }
  return provider
}

/** RFC 4122 UUID v4 via the cross-runtime Web Crypto API. */
export function secureUUID(): string {
  const provider = secureCrypto()
  if (typeof provider.randomUUID === "function") return provider.randomUUID()

  const bytes = provider.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Prefixed opaque ID: `${prefix}_${uuid}`. */
export function securePrefixedId(prefix: string): string {
  const clean = String(prefix || "id").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "id"
  return `${clean}_${secureUUID()}`
}

/** Hex string of n cryptographically random bytes (default 16 → 32 hex chars). */
export function secureHex(bytes = 16): string {
  const size = Number.isFinite(bytes) ? Math.max(1, Math.min(64, Math.trunc(bytes))) : 16
  const data = secureCrypto().getRandomValues(new Uint8Array(size))
  return Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join("")
}
