import assert from "node:assert/strict"
import { getMarketplaceOrderCurrency, parseMarketplaceAvailability } from "../lib/marketplace/checkout-contract.ts"
import { mapMarketplaceListingRecord } from "../lib/marketplace/record-mappers.ts"

assert.equal(getMarketplaceOrderCurrency({ currency: "PI" }), "PI")
assert.equal(getMarketplaceOrderCurrency({ currency: " ghc " }), "GHC")
assert.equal(getMarketplaceOrderCurrency({ currency: "USD" }), null)
assert.equal(getMarketplaceOrderCurrency({ currency: null }), null)
assert.equal(getMarketplaceOrderCurrency(null), null)

assert.equal(parseMarketplaceAvailability(undefined, 7), 7, "omitted edit stock preserves the authoritative existing quantity")
assert.equal(parseMarketplaceAvailability(undefined, 0), 0, "zero stock is preserved when omitted on edit")
assert.equal(parseMarketplaceAvailability(0), 0, "explicit zero remains zero")
assert.equal(parseMarketplaceAvailability(9999), 9999)
assert.equal(parseMarketplaceAvailability(-1), null)
assert.equal(parseMarketplaceAvailability(1.5), null)
assert.equal(parseMarketplaceAvailability("4"), null, "stock input rejects string coercion")
assert.equal(parseMarketplaceAvailability(10000), null)

const noStock = mapMarketplaceListingRecord({ id: "listing-no-stock", title: "Unknown stock" })
assert.equal(noStock?.availability, 0, "missing listing stock fails closed instead of inventing one unit")
const zeroStock = mapMarketplaceListingRecord({ id: "listing-zero", availability: 0 })
assert.equal(zeroStock?.availability, 0, "explicit zero stock survives mapping")
const stocked = mapMarketplaceListingRecord({ id: "listing-stocked", availability: 12 })
assert.equal(stocked?.availability, 12)

console.log("Phase 9 marketplace contracts: 16/16 assertions PASS")
