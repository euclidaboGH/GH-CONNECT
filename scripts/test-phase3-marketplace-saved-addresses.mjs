import assert from "node:assert/strict"
import { addressErrorResponse, readAddressFields, buildSavePayload, cleanLabel, formatAddressSummary, isAddressId, maskPhone, parseSavedAddress, parseSavedAddresses, pickDefaultAddress, MAX_SAVED_ADDRESSES } from "../lib/marketplace/saved-addresses.ts"

const ID1 = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
const row = (o = {}) => ({ id: ID1, label: "Home", fullName: "Ama Mensah", line1: "12 Palm Road", line2: "", city: "Accra", region: "GA", postalCode: "gk-123", country: "gh", phone: "+233 24 123 4567", isDefault: false, updatedAt: "2026-11-01T00:00:00Z", ...o })

// ids and labels
assert.equal(isAddressId(ID1), true)
assert.equal(isAddressId("../etc/passwd"), false)
assert.equal(isAddressId(null), false)
assert.equal(cleanLabel("  \u0000Work\n place  "), "Work place")
assert.equal(cleanLabel(""), "Home")
assert.equal(cleanLabel("x".repeat(100)).length, 40)

// parsing is defensive and normalizing
const ok = parseSavedAddress(row())
assert.ok(ok)
assert.equal(ok.country, "GH")
assert.equal(ok.postalCode, "GK-123")
assert.equal(ok.phone, "+233241234567")
assert.equal(parseSavedAddress(row({ id: "nope" })), null)
assert.equal(parseSavedAddress(row({ city: "" })), null)
assert.equal(parseSavedAddress(null), null)
assert.equal(parseSavedAddress("x"), null)

// list parsing: drops malformed, de-duplicates, bounds
const many = Array.from({ length: 30 }, (_, i) => row({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }))
assert.equal(parseSavedAddresses(many).length, MAX_SAVED_ADDRESSES)
assert.equal(parseSavedAddresses([row(), row(), { bad: true }]).length, 1)
assert.deepEqual(parseSavedAddresses("nope"), [])

// default selection
const a = parseSavedAddress(row({ id: ID1, isDefault: false, updatedAt: "2026-11-01T00:00:00Z" }))
const b = parseSavedAddress(row({ id: ID2, isDefault: false, updatedAt: "2026-11-10T00:00:00Z" }))
assert.equal(pickDefaultAddress([a, b]).id, ID2, "falls back to most recently updated")
assert.equal(pickDefaultAddress([a, { ...b, isDefault: true }]).id, ID2, "explicit default wins")
assert.equal(pickDefaultAddress([]), null)

// display helpers never leak the full phone
assert.equal(formatAddressSummary(a), "12 Palm Road, Accra, GA GK-123, GH")
assert.ok(!formatAddressSummary(a).includes("233"))
assert.equal(maskPhone("+233241234567"), "+•••••••••567")
assert.equal(maskPhone("12"), "")

// save payload building
const built = buildSavePayload({ label: " Office ", fullName: "Ama Mensah", line1: "12 Palm Road", city: "Accra", country: "gh", phone: "0241234567" }, { makeDefault: true })
assert.equal(built.ok, true)
assert.equal(built.payload.label, "Office")
assert.equal(built.payload.id, null)
assert.equal(built.payload.makeDefault, true)
const bad = buildSavePayload({ fullName: "A", line1: "1", city: "", country: "", phone: "1" })
assert.equal(bad.ok, false)
assert.ok(bad.issues.includes("fullName") && bad.issues.includes("phone"))
assert.deepEqual(buildSavePayload({ fullName: "Ama Mensah", line1: "12 Palm Road", city: "Accra", country: "GH", phone: "0241234567" }, { id: "not-a-uuid" }), { ok: false, issues: ["id"] })
assert.equal(buildSavePayload({ fullName: "Ama Mensah", line1: "12 Palm Road", city: "Accra", country: "GH", phone: "0241234567" }, { id: ID1 }).payload.id, ID1)

// strict field reader: no coercion of non-string values
const good = readAddressFields({ fullName: "Ama Mensah", line1: "12 Palm Road", city: "Accra", country: "GH", phone: "0241234567" })
assert.equal(good.ok, true)
assert.equal(good.fields.line2, "")
for (const bad of [{ fullName: {} }, { line1: ["x"] }, { phone: 241234567 }, { city: true }]) {
  const r = readAddressFields({ fullName: "Ama Mensah", line1: "12 Palm Road", city: "Accra", country: "GH", phone: "0241234567", ...bad })
  assert.equal(r.ok, false)
  assert.equal(r.invalid.length, 1)
}
assert.equal(readAddressFields({ label: null, line2: undefined }).ok, true)

// error mapping: only whitelisted codes pass through; unknown text is never reflected
assert.deepEqual(addressErrorResponse("ADDRESS_NOT_FOUND"), { status: 404, error: "ADDRESS_NOT_FOUND" })
assert.deepEqual(addressErrorResponse("ADDRESS_LIMIT_REACHED"), { status: 409, error: "ADDRESS_LIMIT_REACHED" })
assert.deepEqual(addressErrorResponse("INVALID_ADDRESS"), { status: 400, error: "INVALID_ADDRESS" })
assert.deepEqual(addressErrorResponse("AUTH_REQUIRED"), { status: 401, error: "AUTH_REQUIRED" })
assert.deepEqual(addressErrorResponse('relation "x" does not exist'), { status: 503, error: "MARKETPLACE_ADDRESSES_FAILED" })
assert.deepEqual(addressErrorResponse(undefined), { status: 503, error: "MARKETPLACE_ADDRESSES_FAILED" })

console.log("Phase 3 marketplace saved-address tests passed")
