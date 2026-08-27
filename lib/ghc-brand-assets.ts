/**
 * Canonical GH Connect brand assets.
 * Always reuse these paths — do not duplicate or redesign logos.
 */

/** Official GreenHaven Coin (GHC) logo — transparent PNG, isolated coin only */
export const GHC_COIN_LOGO = {
  path: "/ghc-coin-logo.png",
  path128: "/ghc-coin-logo.png",
  path64: "/ghc-coin-64.png",
  path32: "/ghc-coin-32.png",
  alt: "GreenHaven Coin (GHC)",
  name: "GreenHaven Coin",
  symbol: "GHC",
  /** Display notes for implementers */
  usage:
    "Isolated coin icon only. Transparent background. Do not recolor, crop into a plate, or invent alternate GHC marks.",
} as const

/** Primary GH Connect wordmark / shield (existing) */
export const GH_CONNECT_LOGO = {
  path: "/gh-connect-logo.png",
  alt: "GH Connect",
} as const
