/**
 * @deprecated Prefer `@/lib/gh-pay` — kept as compatibility shim.
 */
export {
  ghPayPurchase as purchaseWithPi,
  isPiPaymentsAvailable,
  productForMembership,
} from "@/lib/gh-pay"
export type { GhPayResult as CommercePurchaseResult } from "@/lib/gh-pay/client"

// Map legacy product ids
import { ghPayPurchase } from "@/lib/gh-pay"

export type CommerceProductKind =
  | "membership_vip_monthly"
  | "membership_vip_yearly"
  | "membership_vvip_monthly"
  | "membership_vvip_yearly"
  | "profile_boost"
  | "post_boost"
  | "marketplace_feature"
  | "developer_verification"

export async function purchaseWithPiLegacy(productId: CommerceProductKind) {
  const id = productId === "developer_verification" ? "pipeline_verification" : productId
  return ghPayPurchase(id)
}
