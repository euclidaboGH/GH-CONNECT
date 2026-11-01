export interface MarketplaceCartItem {
  listingId: string
  quantity: number
  addedAt: number
  title: string
  price: number
  currency: string
  sellerId: string
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

export function addMarketplaceCartItem(item: Omit<MarketplaceCartItem, "addedAt">): MarketplaceCartItem[] {
  const items = read()
  const index = items.findIndex((existing) => existing.listingId === item.listingId)
  if (index >= 0) {
    const existing = items[index]
    const max = Number.isFinite(item.availability) && Number(item.availability) > 0 ? Number(item.availability) : 99
    items[index] = {
      ...existing,
      ...item,
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
  const next = items
    .map((item) => {
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
