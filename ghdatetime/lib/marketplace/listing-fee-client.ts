/**
 * Client display helpers for marketplace listing fees.
 * Server remains authoritative; these mirror env defaults for honest CTAs.
 * Create fee: GHC_MARKETPLACE_LISTING_FEE_GHC / _PI (testnet defaults 1 GHC / 0.05 Pi).
 * Edit fee: half of create fee (non-refundable platform service).
 */

export type ListingFeeRail = "GHC" | "PI"

export type ListingFeeQuote = {
  amount: number
  currency: ListingFeeRail
  label: string
  nonRefundable: true
}

const DEFAULT_CREATE_GHC = 1
const DEFAULT_CREATE_PI = 0.05

function readPublicNum(key: string): number | null {
  if (typeof process === "undefined") return null
  const raw = process.env[key]
  if (raw == null || String(raw).trim() === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Create-listing fee for the chosen payment rail. */
export function quoteListingCreateFee(rail: ListingFeeRail): ListingFeeQuote {
  if (rail === "GHC") {
    const amount = readPublicNum("NEXT_PUBLIC_GHC_MARKETPLACE_LISTING_FEE_GHC") ?? DEFAULT_CREATE_GHC
    return {
      amount,
      currency: "GHC",
      label: `₲ ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      nonRefundable: true,
    }
  }
  const amount = readPublicNum("NEXT_PUBLIC_GHC_MARKETPLACE_LISTING_FEE_PI") ?? DEFAULT_CREATE_PI
  return {
    amount,
    currency: "PI",
    label: `${amount} π`,
    nonRefundable: true,
  }
}

/** Edit-listing fee = half create fee (platform policy). */
export function quoteListingEditFee(rail: ListingFeeRail): ListingFeeQuote {
  const create = quoteListingCreateFee(rail)
  const amount = Math.round((create.amount / 2) * 1e8) / 1e8
  return {
    amount,
    currency: rail,
    label:
      rail === "GHC"
        ? `₲ ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : `${amount} π`,
    nonRefundable: true,
  }
}

export function formatListingFeeCta(mode: "create" | "edit", rail: ListingFeeRail): string {
  const q = mode === "edit" ? quoteListingEditFee(rail) : quoteListingCreateFee(rail)
  if (mode === "edit") {
    return rail === "GHC" ? `Save changes · ${q.label}` : `Save changes · pay ${q.label}`
  }
  return rail === "GHC" ? `Publish · ${q.label}` : `Publish · pay ${q.label}`
}
