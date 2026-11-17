/**
 * Phase 2 — delivery address validation and normalization (pure).
 * Persisting addresses needs an owner-only server table and is deferred to a
 * reviewed migration; nothing here stores personal data.
 */
export interface AddressInput {
  fullName?: string
  line1?: string
  line2?: string
  city?: string
  region?: string
  postalCode?: string
  country?: string
  phone?: string
}
export interface NormalizedAddress {
  fullName: string; line1: string; line2: string; city: string; region: string; postalCode: string; country: string; phone: string
}
export type AddressIssue = "fullName" | "line1" | "city" | "country" | "phone"

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)

export function normalizeAddress(input: AddressInput): NormalizedAddress {
  const phone = clean(input.phone, 24).replace(/[^\d+]/g, "")
  return {
    fullName: clean(input.fullName, 80), line1: clean(input.line1, 120), line2: clean(input.line2, 120),
    city: clean(input.city, 60), region: clean(input.region, 60), postalCode: clean(input.postalCode, 16).toUpperCase(),
    country: clean(input.country, 2).toUpperCase().length === 2 ? clean(input.country, 2).toUpperCase() : clean(input.country, 56),
    phone: phone.startsWith("+") ? "+" + phone.slice(1).replace(/\+/g, "") : phone.replace(/\+/g, ""),
  }
}

export function validateAddress(input: AddressInput): { address: NormalizedAddress; issues: AddressIssue[] } {
  const address = normalizeAddress(input)
  const issues: AddressIssue[] = []
  if (address.fullName.length < 2) issues.push("fullName")
  if (address.line1.length < 3) issues.push("line1")
  if (address.city.length < 2) issues.push("city")
  if (!address.country) issues.push("country")
  const digits = address.phone.replace(/\D/g, "")
  if (digits.length < 7 || digits.length > 15) issues.push("phone")
  return { address, issues }
}
