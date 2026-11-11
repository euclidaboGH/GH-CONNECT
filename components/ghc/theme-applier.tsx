"use client"

/**
 * Applies appearance theme to documentElement.
 * - Toggles .dark for light/dark surfaces
 * - Sets CSS variables for primary accent + optional wallpaper
 * - Does not replace business logic; pure presentation
 */

import { useEffect } from "react"
import { useGHC } from "@/contexts/ghc-context"
import {
  getThemePreset,
  resolveIsDark,
  type ThemeMode,
} from "@/lib/theme/themes"

export function ThemeApplier() {
  const { settings, ready } = useGHC()

  useEffect(() => {
    if (typeof document === "undefined") return

    const mode = (settings.themeMode as ThemeMode | undefined) || (settings.darkMode ? "dark" : "light")
    const presetId = settings.themeId || "gh-classic"
    const preset = getThemePreset(presetId)

    const apply = () => {
      const isDark = resolveIsDark(mode, settings.darkMode, presetId)
      const root = document.documentElement
      root.classList.toggle("dark", isDark)
      root.dataset.theme = String(presetId)
      root.dataset.themeMode = mode

      root.style.setProperty("--primary", preset.primary)
      root.style.setProperty("--primary-foreground", preset.primaryForeground)
      root.style.setProperty("--color-primary", preset.primary)
      root.style.setProperty("--ring", preset.primary)

      // Wallpaper layer via CSS variables consumed by app shell
      const custom = settings.themeCustomImage || null
      if (custom) {
        // JSON.stringify wraps the data-URL safely for CSS url("...")
        root.style.setProperty("--theme-wallpaper", `url(${JSON.stringify(custom)})`)
        root.style.setProperty("--theme-wallpaper-opacity", String(settings.themeImageOpacity ?? 0.35))
        root.dataset.hasWallpaper = "1"
      } else if (preset.wallpaper) {
        root.style.setProperty("--theme-wallpaper", preset.wallpaper)
        root.style.setProperty("--theme-wallpaper-opacity", "1")
        root.dataset.hasWallpaper = "0"
      } else {
        root.style.removeProperty("--theme-wallpaper")
        root.style.removeProperty("--theme-wallpaper-opacity")
        root.dataset.hasWallpaper = "0"
      }
    }

    apply()

    if (mode === "system" && typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const onChange = () => apply()
      mq.addEventListener?.("change", onChange)
      return () => mq.removeEventListener?.("change", onChange)
    }
  }, [
    ready,
    settings.darkMode,
    settings.themeMode,
    settings.themeId,
    settings.themeCustomImage,
    settings.themeImageOpacity,
  ])

  return null
}
