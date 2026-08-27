/**
 * GH Connect appearance themes.
 * - Mode: light | dark | system
 * - Preset themes: accent + surface styling
 * - Custom: user-uploaded wallpaper (privacy: stored locally / profile settings only)
 */

export type ThemeMode = "light" | "dark" | "system"

export type ThemePresetId =
  | "gh-classic"
  | "emerald-night"
  | "violet-bloom"
  | "ocean-breeze"
  | "sunset-gold"
  | "midnight-ink"
  | "soft-sand"
  | "custom"

export interface ThemePreset {
  id: ThemePresetId
  name: string
  description: string
  /** CSS gradient or solid for preview swatch */
  preview: string
  /** Accent primary hex */
  primary: string
  primaryForeground: string
  /** Optional wallpaper gradient when no custom image */
  wallpaper?: string
  /** Prefer dark surfaces when this preset is active */
  prefersDark?: boolean
  premium?: boolean
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "gh-classic",
    name: "GH Classic",
    description: "Clean white with emerald accents",
    preview: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 50%, #d1fae5 100%)",
    primary: "#059669",
    primaryForeground: "#ffffff",
    wallpaper: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 40%)",
  },
  {
    id: "emerald-night",
    name: "Emerald Night",
    description: "Deep green-black premium dark",
    preview: "linear-gradient(135deg, #022c22 0%, #064e3b 50%, #10b981 100%)",
    primary: "#34d399",
    primaryForeground: "#022c22",
    wallpaper: "linear-gradient(180deg, #020617 0%, #052e1c 60%, #0a1628 100%)",
    prefersDark: true,
  },
  {
    id: "violet-bloom",
    name: "Violet Bloom",
    description: "Soft purple social aesthetic",
    preview: "linear-gradient(135deg, #f5f3ff 0%, #c4b5fd 50%, #7c3aed 100%)",
    primary: "#7C3AED",
    primaryForeground: "#ffffff",
    wallpaper: "linear-gradient(180deg, #faf5ff 0%, #ffffff 45%)",
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Calm teal and sky",
    preview: "linear-gradient(135deg, #ecfeff 0%, #67e8f9 40%, #0e7490 100%)",
    primary: "#0891b2",
    primaryForeground: "#ffffff",
    wallpaper: "linear-gradient(180deg, #ecfeff 0%, #f0fdfa 50%, #ffffff 100%)",
  },
  {
    id: "sunset-gold",
    name: "Sunset Gold",
    description: "Warm amber highlights",
    preview: "linear-gradient(135deg, #fffbeb 0%, #fbbf24 45%, #ea580c 100%)",
    primary: "#d97706",
    primaryForeground: "#ffffff",
    wallpaper: "linear-gradient(180deg, #fffbeb 0%, #ffffff 50%)",
    premium: true,
  },
  {
    id: "midnight-ink",
    name: "Midnight Ink",
    description: "True black OLED-friendly",
    preview: "linear-gradient(135deg, #000000 0%, #1e1b4b 60%, #312e81 100%)",
    primary: "#818cf8",
    primaryForeground: "#0f172a",
    wallpaper: "linear-gradient(180deg, #000000 0%, #0f172a 100%)",
    prefersDark: true,
    premium: true,
  },
  {
    id: "soft-sand",
    name: "Soft Sand",
    description: "Warm neutral minimal",
    preview: "linear-gradient(135deg, #fafaf9 0%, #e7e5e4 50%, #a8a29e 100%)",
    primary: "#78716c",
    primaryForeground: "#ffffff",
    wallpaper: "linear-gradient(180deg, #fafaf9 0%, #ffffff 100%)",
  },
]

export function getThemePreset(id: string | undefined | null): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) || THEME_PRESETS[0]
}

/** Resolve whether dark class should be on <html> */
export function resolveIsDark(
  mode: ThemeMode | undefined,
  darkModeLegacy: boolean | undefined,
  presetId?: string | null
): boolean {
  const preset = getThemePreset(presetId)
  if (mode === "dark") return true
  if (mode === "light") return false
  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
    }
    return Boolean(darkModeLegacy) || Boolean(preset.prefersDark)
  }
  // Legacy: darkMode boolean only
  if (typeof darkModeLegacy === "boolean") return darkModeLegacy
  return Boolean(preset.prefersDark)
}

export const THEME_STORAGE_KEY = "ghc-theme-v1"

export interface ThemeState {
  mode: ThemeMode
  presetId: ThemePresetId | string
  /** Compressed data URL or remote URL — optional custom wallpaper */
  customImage: string | null
  /** Overlay opacity 0–1 for readability over custom image */
  customImageOpacity: number
}

export const DEFAULT_THEME_STATE: ThemeState = {
  mode: "light",
  presetId: "gh-classic",
  customImage: null,
  customImageOpacity: 0.35,
}
