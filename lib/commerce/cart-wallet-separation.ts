/**
 * Cart vs Wallet separation (0.338.16)
 * Marketplace cart is commerce; wallet is dual-rail balances and withdrawals.
 * Never treat cart totals as wallet balances or route withdraw CTAs through cart.
 */

export const SURFACE_WALLET = "wallet" as const
export const SURFACE_CART = "marketplace_cart" as const
export const SURFACE_ORDERS = "marketplace_orders" as const

export type CommerceSurface = typeof SURFACE_WALLET | typeof SURFACE_CART | typeof SURFACE_ORDERS

/** Wallet never hosts cart line items or checkout CTAs as primary balance actions. */
export function isWalletSurface(surface: string): boolean {
  return surface === SURFACE_WALLET
}

/** Cart never hosts Pi withdrawal or earnings claim CTAs. */
export function isCartSurface(surface: string): boolean {
  return surface === SURFACE_CART
}

export function walletPrimaryActions(): readonly string[] {
  return ["view_balances", "withdraw_pi", "claim_ghc", "history", "security_pin"] as const
}

export function cartPrimaryActions(): readonly string[] {
  return ["view_cart", "update_qty", "remove_line", "checkout", "save_for_later"] as const
}

/** Badge counts must not mix cart quantity into wallet attention dots. */
export function isolateCartBadge(cartQty: number): number {
  if (!Number.isFinite(cartQty) || cartQty < 0) return 0
  return Math.min(99, Math.floor(cartQty))
}

export function isolateWalletAttention(flags: {
  pendingPi?: boolean
  reservedPi?: boolean
  pendingGhc?: boolean
}): number {
  let n = 0
  if (flags.pendingPi) n++
  if (flags.reservedPi) n++
  if (flags.pendingGhc) n++
  return n
}

/** Deep links: wallet withdraw must not open cart; cart checkout must not open withdraw. */
export function assertSurfaceRoute(surface: CommerceSurface, path: string): boolean {
  const p = String(path || "").toLowerCase()
  if (surface === SURFACE_WALLET) {
    return !p.includes("/cart") && !p.includes("checkout")
  }
  if (surface === SURFACE_CART) {
    return !p.includes("withdraw") && !p.includes("/wallet")
  }
  return true
}

export const SEPARATION_POLICY =
  "Wallet holds Pi/GHC balances and withdrawals. Marketplace cart holds listing lines and checkout. They never share a primary CTA or badge."
