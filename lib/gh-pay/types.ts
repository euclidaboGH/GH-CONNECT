/**
 * GH Pay — unified Pi commerce types for GreenHaven.
 *
 * Directions:
 * - U2A (User → App): membership, marketplace, boosts, donations, digital goods
 * - A2U (App → User): seller payouts, creator earnings, refunds, approved rewards
 */

export type PayDirection = "u2a" | "a2u"

export type PayCategory =
  | "membership"
  | "marketplace"
  | "boost"
  | "premium_feature"
  | "donation"
  | "sponsored_listing"
  | "digital_product"
  | "service"
  | "seller_payout"
  | "creator_earning"
  | "refund"
  | "reward_payout"
  | "verification"

export type OrderStatus =
  | "created"
  | "awaiting_approval"
  | "awaiting_user"
  | "awaiting_completion"
  | "completed"
  | "fulfilled"
  | "failed"
  | "cancelled"
  | "refunded"

export type FulfillmentSpec =
  | { type: "membership"; tier: "vip" | "vvip"; period: "monthly" | "yearly" }
  | { type: "boost"; target: "profile" | "post"; hours?: number }
  | { type: "marketplace"; feature: string; listingId?: string }
  | { type: "donation"; causeId: string }
  | { type: "sponsored_listing"; listingId: string; days: number }
  | { type: "digital_product"; productSku: string }
  | { type: "premium_feature"; featureKey: string }
  | { type: "service"; serviceKey: string }
  | { type: "payout"; reason: string }
  | { type: "refund"; originalOrderId: string }
  | { type: "verification" }
  | { type: "none" }

export interface GhPayProduct {
  id: string
  direction: PayDirection
  category: PayCategory
  title: string
  description: string
  /** Amount in π */
  amountPi: number
  memo: string
  fulfillment: FulfillmentSpec
  /** When false, product is hidden from store UI but API may still accept */
  active: boolean
}

export interface GhPayOrder {
  orderId: string
  direction: PayDirection
  productId: string
  category: PayCategory
  amountPi: number
  memo: string
  userId: string
  /** A2U recipient Pi uid */
  recipientUid?: string
  status: OrderStatus
  paymentId?: string
  txid?: string
  fulfillment: FulfillmentSpec
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
  fulfilledAt?: number
}

export interface CreateOrderInput {
  productId: string
  metadata?: Record<string, unknown>
  /** Override amount for variable donations (within server caps) */
  amountPi?: number
  /** A2U only */
  recipientUid?: string
}
