/**
 * Phase 1 — landed-cost presentation.
 *
 * Display-only. The server quote remains the payment authority. Amounts in
 * different currencies are never summed: if currencies differ the breakdown is
 * marked as not combinable instead of producing a misleading total.
 */

export interface LandedCostInput {
  unitPrice: number
  quantity: number
  currency: string
  shippingFee?: number | null
  shippingCurrency?: string | null
}

export interface LandedCostBreakdown {
  currency: string
  subtotal: number
  shipping: number | null
  total: number | null
  /** True when a shipping fee exists in a different currency and cannot be added. */
  mixedCurrency: boolean
  /** True when shipping is unknown and the total is therefore not final. */
  shippingPending: boolean
}

function safeAmount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function normalizeCurrency(value: unknown): string {
  const cur = String(value ?? "").trim().toUpperCase()
  return cur === "Π" ? "PI" : cur || "GHC"
}

function roundMoney(value: number): number {
  return Math.round(value * 1e8) / 1e8
}

export function computeLandedCost(input: LandedCostInput): LandedCostBreakdown | null {
  const unit = safeAmount(input.unitPrice)
  const qty = Math.floor(Number(input.quantity))
  if (unit === null || !Number.isFinite(qty) || qty < 1 || qty > 999) return null
  const currency = normalizeCurrency(input.currency)
  const subtotal = roundMoney(unit * qty)
  const fee = input.shippingFee == null ? null : safeAmount(input.shippingFee)
  if (input.shippingFee != null && fee === null) return null
  if (fee === null) return { currency, subtotal, shipping: null, total: null, mixedCurrency: false, shippingPending: true }
  const shipCurrency = normalizeCurrency(input.shippingCurrency ?? currency)
  if (shipCurrency !== currency) {
    return { currency, subtotal, shipping: fee, total: null, mixedCurrency: true, shippingPending: false }
  }
  return { currency, subtotal, shipping: fee, total: roundMoney(subtotal + fee), mixedCurrency: false, shippingPending: false }
}

export function formatLandedCostLine(label: string, amount: number | null, currency: string): string {
  if (amount === null) return `${label}: confirmed at checkout`
  const cur = normalizeCurrency(currency)
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 8 })
  return cur === "GHC" ? `${label}: ₲ ${formatted}` : cur === "PI" ? `${label}: ${formatted} π` : `${label}: ${formatted} ${cur}`
}
