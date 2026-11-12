/**
 * GreenHaven membership GHC pricing policy, version 1.
 *
 * List price is monthly price × paid months. Discounts apply to paid months only.
 * Every paid plan grants one bonus month; the bonus month is not charged.
 * Pi is a separate payment rail with its own monthly base prices, but uses the same duration discounts and bonus-month policy as GHC.
 */
export const MEMBERSHIP_PRICING_VERSION = "2026-10-18-v1" as const
export const MEMBERSHIP_MONTHLY_GHC = { vip: 150, vvip: 300 } as const
export const MEMBERSHIP_MONTHLY_PI = { vip: 1.5, vvip: 3 } as const
export const MEMBERSHIP_PLAN_OPTIONS = [
  { paidMonths: 1, discountPct: 0, bonusMonths: 1 },
  { paidMonths: 4, discountPct: 5, bonusMonths: 1 },
  { paidMonths: 8, discountPct: 10, bonusMonths: 1 },
  { paidMonths: 12, discountPct: 20, bonusMonths: 1 },
] as const

export type PaidMembershipMonths = 1 | 4 | 8 | 12
export type MembershipBillingPeriod = "monthly" | "four_months" | "eight_months" | "yearly"

export function membershipPeriodForPaidMonths(months: PaidMembershipMonths): MembershipBillingPeriod {
  return months === 1 ? "monthly" : months === 4 ? "four_months" : months === 8 ? "eight_months" : "yearly"
}

export function paidMonthsForMembershipPeriod(period: string): PaidMembershipMonths | null {
  if (period === "monthly") return 1
  if (period === "four_months") return 4
  if (period === "eight_months") return 8
  if (period === "yearly") return 12
  return null
}

export type PaidMembershipTier = keyof typeof MEMBERSHIP_MONTHLY_GHC

/** Calendar-month expiry helper so bonus months are not approximated as 30-day blocks. */
export function addCalendarMonths(timestamp: number, months: number): number {
  const source = new Date(timestamp)
  const day = source.getDate()
  const target = new Date(source)
  target.setDate(1)
  target.setMonth(target.getMonth() + months)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  target.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds())
  return target.getTime()
}

export function getMembershipGhcPrice(
  tier: PaidMembershipTier,
  paidMonths: PaidMembershipMonths
) {
  const option = MEMBERSHIP_PLAN_OPTIONS.find((item) => item.paidMonths === paidMonths)
  if (!option) throw new Error("UNSUPPORTED_MEMBERSHIP_DURATION")
  const monthlyListPrice = MEMBERSHIP_MONTHLY_GHC[tier]
  const listPriceGhc = monthlyListPrice * paidMonths
  const discountGhc = Math.round((listPriceGhc * option.discountPct) / 100)
  const chargeGhc = listPriceGhc - discountGhc
  return {
    pricingVersion: MEMBERSHIP_PRICING_VERSION,
    tier,
    paidMonths,
    bonusMonths: option.bonusMonths,
    accessMonths: paidMonths + option.bonusMonths,
    monthlyListPriceGhc: monthlyListPrice,
    listPriceGhc,
    discountPct: option.discountPct,
    discountGhc,
    chargeGhc,
  } as const
}


/** Pi prices use their own monthly base price, then the same plan discount schedule. */
export function getMembershipPiPrice(
  tier: PaidMembershipTier,
  paidMonths: PaidMembershipMonths
) {
  const option = MEMBERSHIP_PLAN_OPTIONS.find((item) => item.paidMonths === paidMonths)
  if (!option) throw new Error("UNSUPPORTED_MEMBERSHIP_DURATION")
  const monthlyListPrice = MEMBERSHIP_MONTHLY_PI[tier]
  const listPricePi = monthlyListPrice * paidMonths
  // Pi supports fractional amounts. Round to 2 decimal places for predictable display and verification.
  const chargePi = Math.round((listPricePi * (100 - option.discountPct)) / 100 * 100) / 100
  return {
    pricingVersion: MEMBERSHIP_PRICING_VERSION,
    tier,
    paidMonths,
    bonusMonths: option.bonusMonths,
    accessMonths: paidMonths + option.bonusMonths,
    monthlyListPricePi: monthlyListPrice,
    listPricePi,
    discountPct: option.discountPct,
    discountPi: Math.round((listPricePi - chargePi) * 100) / 100,
    chargePi,
  } as const
}
