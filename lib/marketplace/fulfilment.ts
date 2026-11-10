export type MarketplaceFulfilmentAction = "seller_fulfill" | "seller_dispatch" | "seller_mark_delivered" | "buyer_confirm" | "dispute" | "cancel_unpaid"
export type MarketplaceFulfilmentMethod = "shipping" | "pickup" | "digital"
export type ParsedMarketplaceFulfilmentInput = {
  action: MarketplaceFulfilmentAction
  note: string
  method?: MarketplaceFulfilmentMethod
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  estimatedDeliveryAt?: number
}
export type FulfilmentParseResult = { ok: true; value: ParsedMarketplaceFulfilmentInput } | { ok: false; error: string }
function boundedText(value: unknown, max: number): string { return typeof value === "string" ? value.trim().slice(0, max) : "" }

export function parseMarketplaceFulfilmentInput(input: unknown, now = Date.now()): FulfilmentParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "INVALID_BODY" }
  const row = input as Record<string, unknown>
  const action = boundedText(row.action, 48).toLowerCase() as MarketplaceFulfilmentAction
  const allowed: MarketplaceFulfilmentAction[] = ["seller_fulfill", "seller_dispatch", "seller_mark_delivered", "buyer_confirm", "dispute", "cancel_unpaid"]
  if (!allowed.includes(action)) return { ok: false, error: "INVALID_ACTION" }
  const note = boundedText(row.note, 500)
  const rawMethod = boundedText(row.method, 16).toLowerCase()
  const method = rawMethod === "shipping" || rawMethod === "pickup" || rawMethod === "digital" ? rawMethod : undefined
  if (rawMethod && !method) return { ok: false, error: "INVALID_FULFILMENT_METHOD" }
  const carrier = boundedText(row.carrier, 80)
  const trackingNumber = boundedText(row.trackingNumber, 120)
  const rawUrl = boundedText(row.trackingUrl, 500)
  let trackingUrl: string | undefined
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl)
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.href.length > 500) throw new Error("invalid")
      trackingUrl = parsed.toString()
    } catch { return { ok: false, error: "INVALID_TRACKING_URL" } }
  }
  const rawEta = boundedText(row.estimatedDeliveryAt, 40)
  const estimatedDeliveryAt = rawEta ? Date.parse(rawEta) : undefined
  if (rawEta && (!Number.isFinite(estimatedDeliveryAt) || estimatedDeliveryAt! < now - 86_400_000 || estimatedDeliveryAt! > now + 366 * 86_400_000)) {
    return { ok: false, error: "INVALID_ESTIMATED_DELIVERY" }
  }
  if (action === "seller_fulfill") {
    if (!method) return { ok: false, error: "FULFILMENT_METHOD_REQUIRED" }
    if (method === "shipping" && (carrier.length < 2 || trackingNumber.length < 3)) return { ok: false, error: "SHIPPING_DETAILS_REQUIRED" }
  }
  return { ok: true, value: { action, note, method, carrier: carrier || undefined, trackingNumber: trackingNumber || undefined, trackingUrl, estimatedDeliveryAt } }
}
