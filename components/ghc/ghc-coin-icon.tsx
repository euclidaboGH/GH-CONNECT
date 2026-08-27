"use client"

/**
 * Canonical GHC (GreenHaven Coin) logo — official asset only.
 * Transparent background; do not wrap in extra colored plates.
 */

import { useState } from "react"

/** Public paths for the official GHC coin (transparent PNG) */
export const GHC_COIN_ASSET = {
  full: "/ghc-coin-logo.png",
  lg: "/ghc-coin-logo.png",
  md: "/ghc-coin-64.png",
  sm: "/ghc-coin-32.png",
} as const

export type GhcCoinSize = "xs" | "sm" | "md" | "lg" | "xl" | number

const SIZE_PX: Record<Exclude<GhcCoinSize, number>, number> = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 40,
  xl: 64,
}

function pickSrc(px: number): string {
  if (px <= 32) return GHC_COIN_ASSET.sm
  if (px <= 64) return GHC_COIN_ASSET.md
  if (px <= 128) return GHC_COIN_ASSET.lg
  return GHC_COIN_ASSET.full
}

export function GhcCoinIcon({
  size = "md",
  className = "",
  alt = "GHC",
  title = "GreenHaven Coin (GHC)",
}: {
  size?: GhcCoinSize
  className?: string
  alt?: string
  title?: string
}) {
  const px = typeof size === "number" ? size : SIZE_PX[size]
  const src = pickSrc(px)
  const [failed, setFailed] = useState(false)

  if (failed) {
    // Minimal fallback glyph — not a redesigned logo
    return (
      <span
        className={`inline-flex items-center justify-center font-bold text-emerald-700 ${className}`}
        style={{ width: px, height: px, fontSize: Math.max(10, px * 0.35) }}
        title={title}
        aria-label={alt}
      >
        ₲
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      title={title}
      width={px}
      height={px}
      className={`inline-block object-contain ${className}`}
      style={{
        width: px,
        height: px,
        background: "transparent",
        // Avoid layout shift / unwanted backgrounds
        verticalAlign: "middle",
      }}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

/** Balance row helper: icon + amount + GHC label */
export function GhcAmount({
  amount,
  size = "md",
  showLabel = true,
  className = "",
  amountClassName = "",
}: {
  amount: number | string
  size?: GhcCoinSize
  showLabel?: boolean
  className?: string
  amountClassName?: string
}) {
  const formatted =
    typeof amount === "number"
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : amount
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <GhcCoinIcon size={size} />
      <span className={`font-bold tabular-nums ${amountClassName}`}>{formatted}</span>
      {showLabel && <span className="text-[11px] font-semibold opacity-80">GHC</span>}
    </span>
  )
}
