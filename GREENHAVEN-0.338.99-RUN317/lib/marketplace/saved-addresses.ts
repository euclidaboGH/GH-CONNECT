/**
 * Phase 3 — saved delivery addresses: client contract (pure).
 * The server table is a held proposal; nothing here stores, fetches or persists data.
 * Reuses Phase 2 validation so the client and the API agree on what a valid address is.
 */
import { validateAddress, type AddressInput, type AddressIssue, type NormalizedAddress } from "./address-validation.ts"

export const MAX_SAVED_ADDRESSES = 10
export const ADDRESS_LABEL_MAX = 40
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SavedAddress extends NormalizedAddress {
  id: string
  label: string
  isDefault: boolean
  updatedAt: string | null
}

export interface SaveAddressPayload extends NormalizedAddress {
  id: string | null
  label: string
  makeDefault: boolean
}

export function cleanLabel(value: unknown): string {
  const label = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, ADDRESS_LABEL_MAX)
  return label || "Home"
}

export function isAddressId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

/** Defensive parse of one server row; returns null for anything malformed. */
export function parseSavedAddress(row: unknown): SavedAddress | null {
  if (!row || typeof row !== "object") return null
  const r = row as Record<string, unknown>
  if (!isAddressId(r.id)) return null
  const { address, issues } = validateAddress({
    fullName: r.fullName as string, line1: r.line1 as string, line2: r.line2 as string, city: r.city as string,
    region: r.region as string, postalCode: r.postalCode as string, country: r.country as string, phone: r.phone as string,
  })
  if (issues.length) return null
  return { ...address, id: r.id, label: cleanLabel(r.label), isDefault: r.isDefault === true, updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null }
}

export function parseSavedAddresses(rows: unknown): SavedAddress[] {
  if (!Array.isArray(rows)) return []
  const out: SavedAddress[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const parsed = parseSavedAddress(row)
    if (!parsed || seen.has(parsed.id)) continue
    seen.add(parsed.id)
    out.push(parsed)
    if (out.length >= MAX_SAVED_ADDRESSES) break
  }
  return out
}

/** The default address, else the most recently updated, else null. */
export function pickDefaultAddress(list: readonly SavedAddress[]): SavedAddress | null {
  if (!list.length) return null
  const flagged = list.find((a) => a.isDefault)
  if (flagged) return flagged
  return [...list].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))[0] ?? null
}

/** One-line summary for a picker. Never includes the phone number. */
export function formatAddressSummary(a: Pick<NormalizedAddress, "line1" | "line2" | "city" | "region" | "postalCode" | "country">): string {
  return [a.line1, a.line2, a.city, [a.region, a.postalCode].filter(Boolean).join(" "), a.country].filter((p) => p && p.trim()).join(", ")
}

/** Masks a phone number for display: keeps a leading + and the last 3 digits. */
export function maskPhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "")
  if (digits.length < 4) return ""
  return `${String(phone).startsWith("+") ? "+" : ""}${"•".repeat(Math.max(0, digits.length - 3))}${digits.slice(-3)}`
}

export type BuildSaveResult =
  | { ok: true; payload: SaveAddressPayload }
  | { ok: false; issues: AddressIssue[] | ["id"] }

export function buildSavePayload(input: AddressInput & { label?: string }, options: { id?: string | null; makeDefault?: boolean } = {}): BuildSaveResult {
  if (options.id != null && !isAddressId(options.id)) return { ok: false, issues: ["id"] }
  const { address, issues } = validateAddress(input)
  if (issues.length) return { ok: false, issues }
  return { ok: true, payload: { ...address, id: options.id ?? null, label: cleanLabel(input.label), makeDefault: options.makeDefault === true } }
}

const ADDRESS_TEXT_FIELDS = ["label", "fullName", "line1", "line2", "city", "region", "postalCode", "country", "phone"] as const
export type AddressTextField = (typeof ADDRESS_TEXT_FIELDS)[number]

/**
 * Strict reader for a request body. Absent/null fields become "" (validation decides if they are required),
 * but a present non-string value (object, array, number, boolean) is rejected instead of being coerced —
 * String({}) would otherwise be saved as "[object Object]".
 */
export function readAddressFields(body: Record<string, unknown>):
  | { ok: true; fields: Record<AddressTextField, string> }
  | { ok: false; invalid: AddressTextField[] } {
  const fields = {} as Record<AddressTextField, string>
  const invalid: AddressTextField[] = []
  for (const key of ADDRESS_TEXT_FIELDS) {
    const value = body[key]
    if (value === undefined || value === null) fields[key] = ""
    else if (typeof value === "string") fields[key] = value
    else invalid.push(key)
  }
  return invalid.length ? { ok: false, invalid } : { ok: true, fields }
}

/** Maps an RPC error code to an HTTP status. Unknown codes never reach the client verbatim. */
export function addressErrorResponse(code: unknown): { status: number; error: string } {
  switch (code) {
    case "ADDRESS_NOT_FOUND": return { status: 404, error: "ADDRESS_NOT_FOUND" }
    case "ADDRESS_LIMIT_REACHED": return { status: 409, error: "ADDRESS_LIMIT_REACHED" }
    case "INVALID_ADDRESS": return { status: 400, error: "INVALID_ADDRESS" }
    case "AUTH_REQUIRED": return { status: 401, error: "AUTH_REQUIRED" }
    default: return { status: 503, error: "MARKETPLACE_ADDRESSES_FAILED" }
  }
}
