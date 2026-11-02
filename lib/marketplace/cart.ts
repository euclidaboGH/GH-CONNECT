export interface MarketplaceCartItem {
  listingId: string
  quantity: number
  addedAt: number
  /** Stable per-cart-line key; reused when order creation is retried. */
  checkoutKey: string
  title: string
  /** Display-only snapshot. Checkout always re-derives price on the server. */
  price: number
  currency: string
  sellerId: string
  media?: string
  /** Last-known inventory hint only; the server remains authoritative. */
  availability?: number
}

const CART_KEY = "gh_marketplace_cart_v1"
const MAX_CART_LINES = 100
const MAX_QUANTITY = 99

function makeCheckoutKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "")
    }
  } catch { /* Fall through to a non-cryptographic, non-secret idempotency token. */ }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function finiteNonNegative(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function normalizeItem(value: unknown): MarketplaceCartItem | null {
  const row = asRecord(value)
  if (!row) return null
  const listingId = typeof row.listingId === "string" ? row.listingId.trim() : ""
  if (!listingId || listingId.length > 160 || /[\u0000-\u001f\u007f]/.test(listingId)) return null
  const rawQuantity = Number(row.quantity)
  const quantity = Number.isSafeInteger(rawQuantity) ? Math.min(MAX_QUANTITY, Math.max(1, rawQuantity)) : 1
  const rawAvailability = row.availability
  const availability = rawAvailability === undefined || rawAvailability === null
    ? undefined
    : Number.isSafeInteger(Number(rawAvailability)) && Number(rawAvailability) >= 0
      ? Number(rawAvailability)
      : undefined
  const title = typeof row.title === "string" ? row.title.slice(0, 300) : "Listing"
  const sellerId = typeof row.sellerId === "string" ? row.sellerId.slice(0, 160) : ""
  const currency = typeof row.currency === "string" && row.currency.trim()
    ? row.currency.trim().toUpperCase().slice(0, 12)
    : "GHC"
  const media = typeof row.media === "string" && row.media.length <= 2048 ? row.media : undefined
  const checkoutKey = typeof row.checkoutKey === "string" && /^[A-Za-z0-9_-]{16,96}$/.test(row.checkoutKey)
    ? row.checkoutKey
    : makeCheckoutKey()
  const addedAt = Number.isFinite(Number(row.addedAt)) && Number(row.addedAt) > 0
    ? Math.floor(Number(row.addedAt))
    : Date.now()
  return {
    listingId,
    quantity: availability === 0 ? quantity : availability === undefined ? quantity : Math.min(quantity, Math.max(1, availability)),
    addedAt,
    checkoutKey,
    title,
    price: finiteNonNegative(row.price),
    currency,
    sellerId,
    ...(media ? { media } : {}),
    ...(availability !== undefined ? { availability } : {}),
  }
}

function read(): MarketplaceCartItem[] {
  try {
    if (typeof window === "undefined") return []
    const raw = window.localStorage.getItem(CART_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const items: MarketplaceCartItem[] = []
    for (const candidate of parsed) {
      const item = normalizeItem(candidate)
      if (!item || seen.has(item.listingId)) continue
      seen.add(item.listingId)
      items.push(item)
      if (items.length >= MAX_CART_LINES) break
    }
    // Migrate older cart records once so order-creation retries keep the same key.
    const normalized = JSON.stringify(items)
    if (raw !== normalized) window.localStorage.setItem(CART_KEY, normalized)
    return items
  } catch {
    return []
  }
}

function write(items: MarketplaceCartItem[]) {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(CART_KEY, JSON.stringify(items.slice(0, MAX_CART_LINES)))
    window.dispatchEvent(new CustomEvent("ghc:marketplace-cart-changed"))
  } catch {
    /* Best-effort local persistence. Server remains authoritative at checkout. */
  }
}

export function getMarketplaceCart(): MarketplaceCartItem[] {
  return read()
}

export function addMarketplaceCartItem(item: Omit<MarketplaceCartItem, "addedAt" | "checkoutKey">): MarketplaceCartItem[] {
  const items = read()
  const requestedAvailability = item.availability
  // A known zero-stock listing must not be converted into an arbitrary fallback stock.
  if (Number.isFinite(requestedAvailability) && Number(requestedAvailability) <= 0) return items
  const index = items.findIndex((existing) => existing.listingId === item.listingId)
  const max = Number.isSafeInteger(requestedAvailability) && Number(requestedAvailability) > 0
    ? Math.min(MAX_QUANTITY, Number(requestedAvailability))
    : MAX_QUANTITY
  if (index >= 0) {
    const existing = items[index]
    items[index] = {
      ...existing,
      ...item,
      checkoutKey: existing.checkoutKey,
      addedAt: existing.addedAt,
      quantity: Math.min(max, Math.max(1, existing.quantity + Math.max(1, Math.floor(item.quantity)))),
    }
  } else {
    if (items.length >= MAX_CART_LINES) return items
    items.unshift({
      ...item,
      quantity: Math.min(max, Math.max(1, Math.floor(item.quantity))),
      checkoutKey: makeCheckoutKey(),
      addedAt: Date.now(),
    })
  }
  write(items)
  return items
}

export function updateMarketplaceCartQuantity(listingId: string, quantity: number): MarketplaceCartItem[] {
  const items = read()
  const next = items.map((item) => {
    if (item.listingId !== listingId) return item
    const max = item.availability === undefined ? MAX_QUANTITY : Math.min(MAX_QUANTITY, Math.max(1, item.availability))
    return { ...item, quantity: Math.min(max, Math.max(1, Number.isFinite(quantity) ? Math.floor(quantity) : 1)) }
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
