"use client"

/**
 * Official GH Connect logo — single source of truth.
 * Asset is a transparent PNG (shield + wordmark). Never place on a dark plate
 * or solid color square; let the page background show through.
 */

const SIZES = {
  /** App bar / compact headers */
  header: "h-10 w-auto max-w-[6.5rem]",
  /** Onboarding flow top bar */
  bar: "h-11 w-auto max-w-[7.5rem]",
  /** Welcome / splash hero — large centered mark */
  hero: "h-[11.5rem] w-auto max-w-[13.5rem] sm:h-[12.5rem] sm:max-w-[14.5rem]",
  /** Compact sticky feed bar */
  compact: "h-8 w-auto max-w-[5.75rem]",
  /** Icon-only feel when space is tight (still full transparent asset) */
  icon: "h-9 w-auto max-w-[2.75rem]",
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
      src="/gh-connect-logo.png"
      alt="GH Connect"
      className={`${SIZES[size]} object-contain object-center bg-transparent ${className}`}
      width={size === "hero" ? 216 : size === "bar" ? 120 : size === "header" ? 104 : size === "icon" ? 44 : 92}
      height={size === "hero" ? 252 : size === "bar" ? 44 : size === "header" ? 40 : size === "icon" ? 36 : 32}
      decoding="async"
      style={{ background: "transparent" }}
      {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
    />
  )
}
