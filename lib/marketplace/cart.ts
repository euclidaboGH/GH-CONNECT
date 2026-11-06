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
const MAX_CART_LINES = 100
const MAX_QUANTITY = 99

function boundedText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) return undefined
  return text
}

function normalizeCartItem(value: unknown): MarketplaceCartItem | null {
  if (!value || typeof value !== "object") return null
  const item = value as Record<string, unknown>
  const listingId = boundedText(item.listingId, 160)
  const title = boundedText(item.title, 300)
  const sellerId = boundedText(item.sellerId, 160)
  const currency = boundedText(item.currency, 8)?.toUpperCase()
  const price = item.price
  const quantity = item.quantity
  if (!listingId || !title || !sellerId || !currency || !/^[A-Z0-9]{2,8}$/.test(currency)) return null
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 1_000_000_000_000) return null
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) return null

  const availabilityValue = item.availability
  const availability = typeof availabilityValue === "number" && Number.isFinite(availabilityValue) && availabilityValue >= 0
    ? Math.min(1_000_000, Math.floor(availabilityValue))
    : undefined
  const maxQuantity = availability && availability > 0 ? Math.min(MAX_QUANTITY, availability) : MAX_QUANTITY
  const addedAtValue = item.addedAt
  const addedAt = typeof addedAtValue === "number" && Number.isFinite(addedAtValue) && addedAtValue > 0 ? addedAtValue : Date.now()
  const sellerName = boundedText(item.sellerName, 120)
  const media = boundedText(item.media, 2048)

  return {
    listingId,
    quantity: Math.min(MAX_QUANTITY, maxQuantity, Math.max(1, Math.floor(quantity))),
    addedAt,
    title,
    price,
    currency,
    sellerId,
    ...(sellerName ? { sellerName } : {}),
    ...(media ? { media } : {}),
    ...(availability !== undefined ? { availability } : {}),
  }
}

function normalizeCart(value: unknown): MarketplaceCartItem[] {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, MarketplaceCartItem>()
  for (const raw of value.slice(0, MAX_CART_LINES * 2)) {
    const item = normalizeCartItem(raw)
    if (!item) continue
    const existing = unique.get(item.listingId)
    if (!existing) unique.set(item.listingId, item)
    else {
      const max = item.availability && item.availability > 0
        ? Math.min(MAX_QUANTITY, item.availability)
        : MAX_QUANTITY
      existing.quantity = Math.min(max, existing.quantity + item.quantity)
    }
    if (unique.size >= MAX_CART_LINES) break
  }
  return Array.from(unique.values())
}

function read(): MarketplaceCartItem[] {
  try {
    if (typeof window === "undefined") return []
    const raw = window.localStorage.getItem(CART_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const normalized = normalizeCart(parsed)
    // Repair malformed/legacy cache once so every consumer sees the same contract.
    if (raw && JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      window.localStorage.setItem(CART_KEY, JSON.stringify(normalized))
    }
    return normalized
  } catch {
    return []
  }
}

function write(items: MarketplaceCartItem[]) {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(CART_KEY, JSON.stringify(normalizeCart(items)))
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
  const candidate = normalizeCartItem({ ...item, addedAt: Date.now() })
  if (!candidate) return items
  const index = items.findIndex((existing) => existing.listingId === candidate.listingId)
  if (index >= 0) {
    const existing = items[index]
    const max = candidate.availability && candidate.availability > 0
      ? Math.min(MAX_QUANTITY, candidate.availability)
      : MAX_QUANTITY
    items[index] = {
      ...existing,
      ...candidate,
      sellerName: candidate.sellerName || existing.sellerName,
      quantity: Math.min(max, existing.quantity + candidate.quantity),
    }
  } else if (items.length < MAX_CART_LINES) {
    items.unshift(candidate)
  }
  write(items)
  return read()
}

export function updateMarketplaceCartQuantity(listingId: string, quantity: number): MarketplaceCartItem[] {
  const id = boundedText(listingId, 160)
  if (!id || !Number.isFinite(quantity)) return read()
  const items = read()
  const next = items.map((item) => {
    if (item.listingId !== id) return item
    const max = item.availability && item.availability > 0
      ? Math.min(MAX_QUANTITY, item.availability)
      : MAX_QUANTITY
    return { ...item, quantity: Math.min(max, Math.max(1, Math.floor(quantity))) }
  })
  write(next)
  return read()
}

export function removeMarketplaceCartItem(listingId: string): MarketplaceCartItem[] {
  const next = read().filter((item) => item.listingId !== listingId)
  write(next)
  return next
}

/** Remove only lines that were successfully reserved; preserve unrelated/new cart edits. */
export function removeMarketplaceCartItemsByIds(listingIds: string[]): MarketplaceCartItem[] {
  const ids = new Set(listingIds.map((id) => boundedText(id, 160)).filter((id): id is string => Boolean(id)))
  if (!ids.size) return read()
  const next = read().filter((item) => !ids.has(item.listingId))
  write(next)
  return read()
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
