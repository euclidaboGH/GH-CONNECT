/**
 * Client-side community create fee quotes (display only).
 * Server settles via quoteCommunityCreateFee + settlePilotFee.
 */

export type CommunityFeeRail = "GHC" | "PI"

const DEFAULT_CREATE_GHC = 5
const DEFAULT_CREATE_PI = 0.1

function readPublicNum(key: string): number | null {
  try {
    if (typeof process === "undefined" || !process.env) return null
    const raw = process.env[key]
    if (raw == null || raw === "") return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

export function quoteCommunityCreateFeeClient(rail: CommunityFeeRail = "GHC"): {
  amount: number
  currency: CommunityFeeRail
  label: string
  nonRefundable: true
} {
  if (rail === "PI") {
    const amount = readPublicNum("NEXT_PUBLIC_GHC_COMMUNITY_CREATE_FEE_PI") ?? DEFAULT_CREATE_PI
    return {
      amount,
      currency: "PI",
      label: `${amount} π`,
      nonRefundable: true,
    }
  }
  const amount = readPublicNum("NEXT_PUBLIC_GHC_COMMUNITY_CREATE_FEE_GHC") ?? DEFAULT_CREATE_GHC
  return {
    amount,
    currency: "GHC",
    label: `₲ ${amount}`,
    nonRefundable: true,
  }
}
