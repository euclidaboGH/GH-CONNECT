/**
 * High-risk controls pack 0.338.17
 * Source-only safeguards for the 20 highest-impact residual risks.
 * Does not change financial settlement math or apply migrations.
 */

/** 1 — Production must remain unapproved until live evidence exists. */
export const PRODUCTION_RELEASE_APPROVED = false

/** 2 — Client fetches to authenticated APIs must include credentials. */
export const AUTHENTICATED_FETCH_CREDENTIALS = "include" as const

/** 3 — Default client timeout for financial/history reads (ms). */
export const FINANCIAL_READ_TIMEOUT_MS = 12_000

/** 4 — Default client timeout for social list reads (ms). */
export const SOCIAL_READ_TIMEOUT_MS = 15_000

/** 5 — Max concurrent sessions (matches identity SESSION_MAX_ACTIVE contract). */
export const SESSION_MAX_ACTIVE_DEFAULT = 8

/** 6 — Marketplace commission is fixed; env cannot raise/lower it. */
export const MARKETPLACE_COMMISSION_BPS_FIXED = 500

/** 7 — Quote/preview never reserves Pi earnings. */
export const PI_QUOTE_RESERVES_FUNDS = false

/** 8 — Remote push remains off until operator secrets + consent path verified. */
export const REMOTE_PUSH_PRODUCTION_ENABLED = false

/** 9 — Demo / placeholder actor IDs must never mutate social graph. */
export const DEMO_ACTOR_ID_PATTERN = /^(demo[-_]|test[-_]|placeholder)/i

export function isDemoActorId(id: string | null | undefined): boolean {
  const s = String(id || "").trim()
  if (!s) return true
  return DEMO_ACTOR_ID_PATTERN.test(s)
}

/** 10 — Settings export denylist for secret-bearing keys. */
export const SETTINGS_EXPORT_FORBIDDEN_KEYS = [
  "password",
  "pin",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "privateKey",
  "mnemonic",
  "seed",
  "apiKey",
  "authorization",
] as const

export function isForbiddenExportKey(key: string): boolean {
  const k = String(key || "").toLowerCase()
  return SETTINGS_EXPORT_FORBIDDEN_KEYS.some((f) => k.includes(f.toLowerCase()))
}

/** 11 — Message idempotency key max (storage contract). */
export const MESSAGE_IDEMPOTENCY_MAX = 80

/** 12 — Message body max. */
export const MESSAGE_BODY_MAX = 8_000

/** 13 — Cart line ceiling. */
export const CART_LINE_MAX = 50

/** 14 — Discovery radius clamp km. */
export function clampDiscoveryRadiusKm(n: number): number {
  if (!Number.isFinite(n)) return 25
  return Math.min(100, Math.max(1, Math.round(n)))
}

/** 15 — Safe display amount: reject negative / non-finite. */
export function safeDisplayAmount(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n)
  if (!Number.isFinite(x) || x < 0) return 0
  return x
}

/** 16 — Pi atomic floor helper (7 dp scale). */
export const PI_ATOMIC_SCALE = 10_000_000
export function floorPiToAtomicSafe(pi: number): number {
  if (!Number.isFinite(pi) || pi <= 0) return 0
  return Math.floor(pi * PI_ATOMIC_SCALE + 1e-9)
}

/** 17 — Cart vs wallet surfaces never share primary CTA. */
export const SURFACE_WALLET = "wallet"
export const SURFACE_CART = "marketplace_cart"

/** 18 — CSP report-only is not a substitute for enforcing CSP in vercel.json. */
export const CSP_ENFORCEMENT_REQUIRED = true

/** 19 — Withdrawal PIN required before payout submit. */
export const WITHDRAWAL_PIN_REQUIRED = true

/** 20 — Fail-closed when identity mapping is missing in production. */
export const PRODUCTION_IDENTITY_MAPPING_REQUIRED = true
