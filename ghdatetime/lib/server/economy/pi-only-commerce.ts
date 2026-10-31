/**
 * Pi ecosystem listing posture:
 * When enabled, in-app commerce fees and paid services settle in π only.
 * GHC remains an internal reward/utility balance (daily claim, referrals, missions)
 * and is not used as a payment rail for listing/community/membership fees.
 *
 * Env: GHC_PI_ONLY_COMMERCE=1 (or true/yes/on)
 * Default ON for production-mainnet-oriented safety; set 0 to re-enable dual-rail fees.
 */

export function isPiOnlyCommerceEnabled(): boolean {
  const raw = String(process.env.GHC_PI_ONLY_COMMERCE ?? "1").trim().toLowerCase()
  if (["0", "false", "no", "off"].includes(raw)) return false
  return true
}

export function commerceFeeCurrency(): "PI" {
  return "PI"
}
