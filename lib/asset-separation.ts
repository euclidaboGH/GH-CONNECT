/**
 * GreenHaven asset separation policy
 *
 *                    GH CONNECT
 *                         │
 *              ┌──────────┴──────────┐
 *              │                     │
 *             PI                    GHC
 *         external asset        internal utility
 *              │                     │
 *       GH Pay / Pi engine      GHC ledger
 *              │                     │
 *        Pi transactions      GHC transactions
 *
 * RULES (enforced in code — do not weaken):
 * 1. Pi (π) is an external network asset settled via Pi Platform / GH Pay.
 * 2. GHC is an internal utility credit on the GreenHaven ledger only.
 * 3. Never imply or implement 1 π = X GHC (or reverse) without an explicit,
 *    governed conversion product approved later — none exists today.
 * 4. Membership may be paid with π (GH Pay) OR with GHC (ledger spend) —
 *    those are alternate rails, not a FX rate between assets.
 * 5. Wallet UI must never show a combined “total wealth” of π + GHC.
 */

export const ASSET_POLICY = {
  /** External: Pi Network */
  PI: {
    code: "PI" as const,
    symbol: "π",
    kind: "external_network_asset" as const,
    engine: "gh_pay" as const,
    convertibleToGhc: false,
  },
  /** Internal: GreenHaven Coin */
  GHC: {
    code: "GHC" as const,
    symbol: "GHC",
    kind: "internal_utility" as const,
    engine: "ghc_ledger" as const,
    convertibleToPi: false,
  },
  /** Explicit: no FX / peg */
  conversionEnabled: false as const,
  walletCopy:
    "GHC is a GreenHaven in-app utility balance — not Pi, not an investment product, and not an external exchange asset.",
  payCopy:
    "GH Pay settles in π on Pi Network. GHC balances are separate and never mixed.",
  /** Primary wallet rails explanation */
  ghcRailsCopy:
    "GHC — send, request and receive between GreenHaven users.",
  piRailsCopy:
    "π — pay GreenHaven services in Pi Browser or receive eligible platform payouts.",
  piPeerCopy:
    "Peer-to-peer π transfers remain in the Pi Wallet.",
  referenceUnitCopy:
    "100 GHC is GreenHaven's internal pricing/reference benchmark only — not a market price and not a promise that GHC can be redeemed for Pi.",
} as const

export type AssetCode = "PI" | "GHC"

/**
 * Reject any attempt to treat Pi amount as GHC or vice versa.
 * Call at boundaries that receive both currencies.
 */
export function assertNoPiGhcConversion(
  context: string,
  opts?: { from?: AssetCode; to?: AssetCode; rate?: number }
): void {
  if (ASSET_POLICY.conversionEnabled) return
  if (opts?.from && opts?.to && opts.from !== opts.to) {
    throw new Error(
      `[asset-separation] Conversion ${opts.from}→${opts.to} is not enabled (${context}). Pi and GHC stay separate.`
    )
  }
  if (opts?.rate != null && Number.isFinite(opts.rate)) {
    throw new Error(
      `[asset-separation] Exchange rate is not enabled (${context}). Never price 1 π = X GHC without a governed product.`
    )
  }
}

/**
 * True only for the same asset — never cross-asset equality.
 */
export function isSameAsset(a: AssetCode, b: AssetCode): boolean {
  return a === b
}

/** Guard for payment intent currency vs ledger */
export function assertPaymentCurrencyIsPi(currency: string, context: string): void {
  if (currency !== "PI" && currency !== "π") {
    // GHC payments use ledger spend — not GH Pay Pi rails
    if (currency === "GHC") {
      throw new Error(
        `[asset-separation] ${context}: GHC must use the ledger, not the Pi payment engine.`
      )
    }
  }
}

export function assertLedgerCurrencyIsGhc(currency: string, context: string): void {
  if (currency === "PI" || currency === "π") {
    throw new Error(
      `[asset-separation] ${context}: Pi must not be written to the GHC ledger.`
    )
  }
}
