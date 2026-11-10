/**
 * Marketplace revenue engine
 *
 * Buy: GHC · Pi (server-verified)
 * Sell: listings · inventory · orders · reputation
 *
 * Lifecycle:
 *   created → payment_pending → payment_verified → confirmed
 *     → fulfilling → completed → seller payout entitlement
 */
export type { MarketplaceListing, MarketplaceOrder, SellerProfileView, OrderStatus } from "@/lib/domains/marketplace-domain"
export { MARKETPLACE_CATEGORIES, PROMOTION_CATALOG } from "@/lib/domains/marketplace-domain"
