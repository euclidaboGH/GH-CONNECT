/**
 * Section 5 — Identity, Settings & Platform essential controls (0.338.15)
 */

export const SESSION_MAX_ACTIVE_DEFAULT = 8
export const SUPPORTED_NODE = "24.15.0"
export const PRODUCTION_APPROVED = false

export const FORBIDDEN_SETTINGS_EXPORT_RE =
  /(password|secret|token|pin|private.?key|mnemonic|seed|authorization|cookie|session|api.?key|service.?role|vapid|webhook|recovery.?code|access.?token|refresh.?token|bearer|jwt|signing.?key)/i

export function isExportableSettingsKey(key: string): boolean {
  const k = String(key || "").trim()
  if (!k || k.length > 80) return false
  if (FORBIDDEN_SETTINGS_EXPORT_RE.test(k)) return false
  return true
}

export function clampDiscoveryRadiusKm(value: unknown, fallback = 25): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(1, Math.round(n)))
}

export function isDemoOrPlaceholderUserId(id: string): boolean {
  const t = String(id || "").trim()
  if (!t) return true
  if (t === "me") return true
  return /^(demo|sample|placeholder)[-_]/i.test(t)
}

export const BOTTOM_NAV_ITEMS = ["home", "discover", "messages", "communities", "profile"] as const
