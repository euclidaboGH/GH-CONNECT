/**
 * Dual payment rails for eligible GreenHaven commerce.
 * Prices are independent per rail — never derived from a free FX rate.
 */

import { ASSET_POLICY } from "@/lib/asset-separation"

export type PaymentRail = "ghc" | "pi"

export type DualRailPrice = {
  rail: PaymentRail
  amount: number
  currency: "GHC" | "PI"
  label: string
}

export type DualRailOffer = {
  productId: string
  title: string
  ghc?: DualRailPrice
  pi?: DualRailPrice
  note?: string
}

export function dualRailCopy(): string {
  return ASSET_POLICY.dualRailCopy
}

/** Build offer with independent prices (never amountGhc / rate). */
export function makeDualRailOffer(input: {
  productId: string
  title: string
  amountGhc?: number
  amountPi?: number
  note?: string
}): DualRailOffer {
  const offer: DualRailOffer = {
    productId: input.productId,
    title: input.title,
    note: input.note || dualRailCopy(),
  }
  if (input.amountGhc != null && Number.isFinite(input.amountGhc) && input.amountGhc >= 0) {
    offer.ghc = {
      rail: "ghc",
      amount: input.amountGhc,
      currency: "GHC",
      label: `${input.amountGhc} GHC`,
    }
  }
  if (input.amountPi != null && Number.isFinite(input.amountPi) && input.amountPi >= 0) {
    offer.pi = {
      rail: "pi",
      amount: input.amountPi,
      currency: "PI",
      label: `${input.amountPi} π`,
    }
  }
  return offer
}

export function railsAvailable(offer: DualRailOffer): PaymentRail[] {
  const rails: PaymentRail[] = []
  if (offer.ghc) rails.push("ghc")
  if (offer.pi) rails.push("pi")
  return rails
}
