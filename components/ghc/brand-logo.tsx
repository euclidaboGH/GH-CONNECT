"use client"

/**
 * Official GreenHaven logo — single source of truth.
 * Asset is a transparent PNG (shield + wordmark). Never place on a dark plate
 * or solid color square; let the page background show through.
 */

import { brandAssets } from "@/lib/design-system"

const SIZES = {
  /** App bar / compact headers */
  header: "h-7 w-auto max-w-[4.5rem]",
  /** Onboarding flow top bar */
  bar: "h-8 w-auto max-w-[5.5rem]",
  /** Welcome / splash hero — large centered mark */
  hero: "h-[7.5rem] w-auto max-w-[8.75rem] sm:h-[8.5rem] sm:max-w-[9.75rem]",
  /** Compact sticky feed bar */
  compact: "h-6 w-auto max-w-[4rem]",
  /** Icon-only feel when space is tight (still full transparent asset) */
  icon: "h-7 w-auto max-w-[2.25rem]",
} as const

export type BrandLogoSize = keyof typeof SIZES

export function BrandLogo({
  size = "header",
  className = "",
  priority = false,
}: {
  size?: BrandLogoSize
  className?: string
  /** Hint for LCP on splash/welcome */
  priority?: boolean
}) {
  return (
    <img
      src={brandAssets.greenHavenLogo}
      alt="GreenHaven"
      className={`${SIZES[size]} object-contain object-center bg-transparent ${className}`}
      width={size === "hero" ? 140 : size === "bar" ? 88 : size === "header" ? 60 : size === "icon" ? 36 : 52}
      height={size === "hero" ? 136 : size === "bar" ? 32 : size === "header" ? 28 : size === "icon" ? 28 : 24}
      decoding="async"
      style={{ background: "transparent" }}
      {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
    />
  )
}
