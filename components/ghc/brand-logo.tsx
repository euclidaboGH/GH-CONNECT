"use client"

/**
 * Official GreenHaven logo — single source of truth (transparent PNGs, never on a plate).
 * Variants:
 *  - hero:    stacked full logo (mark + wordmark + tagline) for splash / welcome
 *  - header / bar / compact: horizontal lockup (mark + wordmark)
 *  - icon:    mark only
 * Dark-background variants (lifted greens, light wordmark) are used automatically in dark
 * theme, or always when `onDark` is set (splash, consent, lock screens use a fixed dark surface).
 */

import { brandAssets } from "@/lib/design-system"

const SIZES = {
  header: "h-7 w-auto",
  bar: "h-8 w-auto",
  hero: "h-[8.5rem] w-auto max-w-[13rem] sm:h-[9.5rem] sm:max-w-[14.5rem]",
  compact: "h-6 w-auto",
  icon: "h-7 w-auto",
} as const

export type BrandLogoSize = keyof typeof SIZES

const SRC: Record<BrandLogoSize, { light: string; dark: string; w: number; h: number }> = {
  hero: { light: brandAssets.greenHavenLogo, dark: brandAssets.greenHavenLogoDark, w: 232, h: 150 },
  header: { light: brandAssets.greenHavenLockup, dark: brandAssets.greenHavenLockupDark, w: 136, h: 28 },
  bar: { light: brandAssets.greenHavenLockup, dark: brandAssets.greenHavenLockupDark, w: 155, h: 32 },
  compact: { light: brandAssets.greenHavenLockup, dark: brandAssets.greenHavenLockupDark, w: 116, h: 24 },
  icon: { light: brandAssets.greenHavenMark, dark: brandAssets.greenHavenMarkDark, w: 34, h: 28 },
}

export function BrandLogo({
  size = "header",
  className = "",
  priority = false,
  onDark = false,
}: {
  size?: BrandLogoSize
  className?: string
  /** Hint for LCP on splash/welcome */
  priority?: boolean
  /** Surface is always dark regardless of theme (splash, welcome, lock screens). */
  onDark?: boolean
}) {
  const s = SRC[size]
  const common = {
    alt: "GreenHaven",
    width: s.w,
    height: s.h,
    decoding: "async" as const,
    style: { background: "transparent" },
    ...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const }),
  }
  const base = `${SIZES[size]} object-contain bg-transparent ${className}`
  if (onDark) return <img src={s.dark} className={base} {...common} />
  return (
    <>
      <img src={s.light} className={`${base} dark:hidden`} {...common} />
      <img src={s.dark} className={`${base} hidden dark:block`} {...common} aria-hidden="true" alt="" />
    </>
  )
}
