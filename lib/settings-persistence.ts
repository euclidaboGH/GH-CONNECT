/**
 * Phase 9 — Settings & Filters persistence helpers.
 * Never export secrets, session tokens, or payment credentials.
 */

/** Keys that must never appear in a settings export payload. */
const FORBIDDEN_EXPORT_KEY_RE =
  /(password|secret|token|pin|private.?key|mnemonic|seed|authorization|cookie|session|api.?key|service.?role|vapid|webhook|recovery.?code|access.?token|refresh.?token|bearer|jwt|signing.?key)/i

export function isExportableSettingsKey(key: string): boolean {
  const k = String(key || "").trim()
  if (!k || k.length > 80) return false
  if (FORBIDDEN_EXPORT_KEY_RE.test(k)) return false
  return true
}

/**
 * Build a portable settings snapshot for backup/export.
 * Drops forbidden keys and non-JSON-safe values.
 */
export function buildSettingsExportPayload(
  settings: Record<string, unknown>,
  meta?: { exportedAt?: string; appVersion?: string }
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    _schema: "ghc.settings.export.v1",
    _exportedAt: meta?.exportedAt || new Date().toISOString(),
    _appVersion: meta?.appVersion || null,
  }
  for (const [key, value] of Object.entries(settings || {})) {
    if (!isExportableSettingsKey(key)) continue
    if (value === undefined) continue
    if (typeof value === "function") continue
    if (typeof value === "string" && value.length > 50_000) continue
    try {
      JSON.stringify(value)
      out[key] = value
    } catch {
      /* skip non-serializable */
    }
  }
  return out
}

/**
 * Merge an imported settings payload into existing settings.
 * Only known-safe keys apply; forbidden keys ignored.
 */
export function mergeImportedSettings(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...current }
  for (const [key, value] of Object.entries(incoming || {})) {
    if (key.startsWith("_")) continue
    if (!isExportableSettingsKey(key)) continue
    if (value === undefined) continue
    try {
      JSON.stringify(value)
      next[key] = value
    } catch {
      /* skip */
    }
  }
  return next
}

/** Bound discovery / age controls used across Settings + Discover. */
export function clampDiscoveryRadiusKm(value: unknown, fallback = 25): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(1, Math.round(n)))
}

export function clampAgeRange(ageMin: unknown, ageMax: unknown): { ageMin: number; ageMax: number } {
  let min = typeof ageMin === "number" ? ageMin : Number(ageMin)
  let max = typeof ageMax === "number" ? ageMax : Number(ageMax)
  if (!Number.isFinite(min)) min = 18
  if (!Number.isFinite(max)) max = 65
  min = Math.min(100, Math.max(18, Math.round(min)))
  max = Math.min(100, Math.max(18, Math.round(max)))
  if (min > max) {
    const t = min
    min = max
    max = t
  }
  return { ageMin: min, ageMax: max }
}

export const SETTINGS_PHASE = "9-settings-filters" as const
