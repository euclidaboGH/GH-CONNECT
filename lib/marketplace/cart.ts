/**
 * Local cart cache — convenience only.
 * Server remains authoritative at order create / pay (inventory, price, seller).
 */

export interface MarketplaceCartItem {
  listingId: string
  quantity: number
  addedAt: number
  title: string
  price: number
  currency: string
  sellerId: string
  /** Optional display name captured at add-time (never trusted for settlement). */
  sellerName?: string
  media?: string
  availability?: number
}

const CART_KEY = "gh_marketplace_cart_v1"

function read(): MarketplaceCartItem[] {
  try {
    if (typeof window === "undefined") return []
    const raw = window.localStorage.getItem(CART_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item.listingId === "string")
  } catch {
    return []
  }
}

function write(items: MarketplaceCartItem[]) {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(CART_KEY, JSON.stringify(items.slice(0, 100)))
    window.dispatchEvent(new CustomEvent("ghc:marketplace-cart-changed"))
  } catch {
    /* Best-effort local persistence. Server remains authoritative at checkout. */
  }
}

export function getMarketplaceCart(): MarketplaceCartItem[] {
  return read()
}

/** Unit count for bottom-nav badge (sum of quantities). */
export function getMarketplaceCartUnitCount(items?: MarketplaceCartItem[]): number {
  const list = items || read()
  return list.reduce((n, it) => n + Math.max(0, Number(it.quantity) || 0), 0)
}

export function addMarketplaceCartItem(item: Omit<MarketplaceCartItem, "addedAt">): MarketplaceCartItem[] {
  const items = read()
  const index = items.findIndex((existing) => existing.listingId === item.listingId)
  if (index >= 0) {
    const existing = items[index]
    const max = Number.isFinite(item.availability) && Number(item.availability) > 0 ? Number(item.availability) : 99
    items[index] = {
      ...existing,
      ...item,
      sellerName: item.sellerName || existing.sellerName,
      quantity: Math.min(Math.max(1, existing.quantity + Math.max(1, item.quantity)), max),
    }
  } else {
    const max = Number.isFinite(item.availability) && Number(item.availability) > 0 ? Number(item.availability) : 99
    items.unshift({ ...item, quantity: Math.min(Math.max(1, item.quantity), max), addedAt: Date.now() })
  }
  write(items)
  return items
}

export function updateMarketplaceCartQuantity(listingId: string, quantity: number): MarketplaceCartItem[] {
  const items = read()
  const next = items.map((item) => {
    if (item.listingId !== listingId) return item
    const max = Number.isFinite(item.availability) && Number(item.availability) > 0 ? Number(item.availability) : 99
    return { ...item, quantity: Math.min(Math.max(1, Math.floor(quantity)), max) }
  })
  write(next)
  return next
}

export function removeMarketplaceCartItem(listingId: string): MarketplaceCartItem[] {
  const next = read().filter((item) => item.listingId !== listingId)
  write(next)
  return next
}

export function clearMarketplaceCart(): void {
  write([])
}

/** Drop lines that belong to the given seller (e.g. own listings before checkout). */
export function removeMarketplaceCartItemsBySeller(sellerId: string): MarketplaceCartItem[] {
  const id = String(sellerId || "").trim()
  if (!id) return read()
  const next = read().filter((item) => item.sellerId !== id)
  write(next)
  return next
}
