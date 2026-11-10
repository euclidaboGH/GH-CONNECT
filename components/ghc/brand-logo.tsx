"use client"

/**
 * Official GreenHaven logo — single source of truth (transparent PNGs, never on a plate).
 * Variants:
 *  - hero:    stacked full logo (mark + wordmark + tagline) for splash / welcome
 *  - header / bar / compact: horizontal lockup (mark + wordmark)
 *  - icon:    mark only
 * Dark-background variants retain the approved symbol and lift the wordmark for contrast.
 */

import { brandAssets } from "@/lib/design-system"

const SIZES = {
  header: "h-7 w-auto max-w-[11rem]",
  bar: "h-8 w-auto max-w-[14rem]",
  hero: "h-[10rem] w-auto max-w-[10.75rem] sm:h-[11rem] sm:max-w-[11.75rem]",
  compact: "h-6 w-auto max-w-[9.5rem]",
  icon: "h-7 w-auto max-w-8",
} as const

export type BrandLogoSize = keyof typeof SIZES

const SRC: Record<BrandLogoSize, { light: string; dark: string; w: number; h: number }> = {
  hero: { light: brandAssets.greenHavenLogo, dark: brandAssets.greenHavenLogoDark, w: 1221, h: 1149 },
  header: { light: brandAssets.greenHavenLockup, dark: brandAssets.greenHavenLockupDark, w: 1182, h: 193 },
  bar: { light: brandAssets.greenHavenLockup, dark: brandAssets.greenHavenLockupDark, w: 1182, h: 193 },
  compact: { light: brandAssets.greenHavenLockup, dark: brandAssets.greenHavenLockupDark, w: 1182, h: 193 },
  icon: { light: brandAssets.greenHavenMark, dark: brandAssets.greenHavenMarkDark, w: 652, h: 522 },
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
    width: s.w,
    height: s.h,
    decoding: "async" as const,
    style: { background: "transparent" },
    ...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const }),
  }
  const base = `${SIZES[size]} object-contain bg-transparent ${className}`
  if (onDark) return <img src={s.dark} className={base} alt="GreenHaven" {...common} />
  return (
    <>
      <img src={s.light} className={`${base} dark:hidden`} alt="GreenHaven" {...common} />
      <img src={s.dark} className={`${base} hidden dark:block`} {...common} aria-hidden="true" alt="" />
    </>
  )
}
