/**
 * GreenHaven asset separation policy (Phase 1 — dual rails)
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
 * 3. Free automatic FX (1 π = X GHC or reverse) is NOT enabled.
 * 4. Eligible services may be paid with π OR GHC as alternate rails —
 *    those are separate prices, not a conversion between balances.
 * 5. Governed acquisition: verified Pi payment may credit a fixed GHC pack
 *    only via server purchase-ghc (product catalog + idempotent credit).
 * 6. GHC→π settlement/withdrawal stays operator-gated and funded — not a swap.
 * 7. Wallet UI never shows a combined “total wealth” of π + GHC.
 */

export const ASSET_POLICY = {
  PI: {
    code: "PI" as const,
    symbol: "π",
    kind: "external_network_asset" as const,
    engine: "gh_pay" as const,
    convertibleToGhc: false,
  },
  GHC: {
    code: "GHC" as const,
    symbol: "GHC",
    kind: "internal_utility" as const,
    engine: "ghc_ledger" as const,
    convertibleToPi: false,
  },
  /** Free market-style FX is off. Governed pack products are separate. */
  conversionEnabled: false as const,
  /** Governed Pi-funded GHC packs (server catalog) — not an exchange rate. */
  governedPackPurchaseEnabled: true as const,
  walletCopy:
    "GHC is a GreenHaven in-app utility balance — not Pi, not an investment product, and not an external exchange asset.",
  payCopy:
    "Eligible services accept π (GH Pay) or GHC (ledger) as separate payment rails. Balances are never mixed.",
  ghcRailsCopy:
    "GHC — earn, send, request, receive, and spend on approved GreenHaven utilities.",
  piRailsCopy:
    "π — pay GreenHaven services in Pi Browser; peer π stays in Pi Wallet.",
  piPeerCopy:
    "Peer-to-peer π transfers remain in the Pi Wallet.",
  referenceUnitCopy:
    "Any internal GHC-per-Pi figure is a pricing benchmark for packs/membership only — not a market price and not a promise of redemption.",
  dualRailCopy:
    "Choose π or GHC at checkout. Each rail is verified independently before fulfillment.",
  packPurchaseCopy:
    "Get GHC with Pi buys a fixed utility pack after Pi payment is verified. It is not a live exchange rate.",
  settlementCopy:
    "GHC→π settlement is only available when GreenHaven enables a funded, approved payout product.",
} as const

export type AssetCode = "PI" | "GHC"

/**
 * Reject any attempt to treat Pi amount as GHC or vice versa as free FX.
 * Governed pack products use explicit productId + server catalog instead.
 */
export function assertNoPiGhcConversion(
  context: string,
  opts?: { from?: AssetCode; to?: AssetCode; rate?: number }
): void {
  if (ASSET_POLICY.conversionEnabled) return
  if (opts?.rate != null && Number.isFinite(opts.rate)) {
    throw new Error(
      `[asset-separation] Free FX rate forbidden in ${context}. Use dual rails or governed pack purchase.`
    )
  }
  if (opts?.from && opts?.to && opts.from !== opts.to) {
    throw new Error(
      `[asset-separation] Cannot convert ${opts.from}→${opts.to} in ${context}. Use dual rails or governed pack purchase.`
    )
  }
}

/** True when UI may show “Get GHC with Pi” pack products (not free FX). */
export function mayOfferGovernedGhcPacks(): boolean {
  return ASSET_POLICY.governedPackPurchaseEnabled === true
}
