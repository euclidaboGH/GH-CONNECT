/** Orders — buyer/seller views over the canonical marketplace order lifecycle. */
export type { MarketplaceOrder, OrderStatus } from "@/lib/domains/marketplace-domain"
export { isTerminalOrderStatus, orderStatusLabel } from "@/lib/active-upgrades/orders"
export * from "@/lib/marketplace/order-lifecycle"
