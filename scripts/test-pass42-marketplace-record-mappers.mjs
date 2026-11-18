import assert from "node:assert/strict"
import {
  mapMarketplaceListingRecord,
  mapMarketplaceOrderRecord,
  mapSavedMarketplaceListingRecord,
} from "../lib/marketplace/record-mappers.ts"

const fixedNow = 1_798_000_000_000

const listing = mapMarketplaceListingRecord({
  id: "listing-1", title: "Verified listing", price: "12.5", currency: "GHC",
  created_at: "2026-10-30T10:00:00.000Z", updated_at: "2026-10-31T10:00:00.000Z",
  media: ["/image.jpg", null], tags: ["tools", 7],
}, fixedNow)
assert.equal(listing?.id, "listing-1")
assert.equal(listing?.price, 12.5)
assert.equal(listing?.createdAt, Date.parse("2026-10-30T10:00:00.000Z"))
assert.equal(listing?.updatedAt, Date.parse("2026-10-31T10:00:00.000Z"))
assert.deepEqual(listing?.media, ["/image.jpg"])
assert.deepEqual(listing?.tags, ["tools", "7"])
assert.equal(mapMarketplaceListingRecord({ title: "Missing identity" }, fixedNow), null)

const saved = mapSavedMarketplaceListingRecord({
  listing_id: "saved-1", title: "Saved item", created_at: 100, updated_at: 250,
  metadata: { category: "Education", location: "Abuja", media: ["cover.jpg"] },
}, fixedNow)
assert.equal(saved?.id, "saved-1")
assert.equal(saved?.updatedAt, 250, "saved mapper must retain updated_at rather than overwrite it with created_at")
assert.equal(saved?.category, "Education")
assert.equal(saved?.condition, "not_applicable")

const order = mapMarketplaceOrderRecord({
  id: "order-1", listing_id: "listing-1", buyer_id: "buyer-1", seller_id: "seller-1",
  created_at: "2026-10-31T09:00:00Z", confirmed_at: "2026-10-31T09:10:00Z",
  quantity: "2", unit_price: "5", payment_status: "confirmed", delivery_status: "in_transit",
}, fixedNow)
assert.equal(order?.id, "order-1")
assert.equal(order?.createdAt, Date.parse("2026-10-31T09:00:00Z"))
assert.equal(order?.confirmedAt, Date.parse("2026-10-31T09:10:00Z"))
assert.equal(order?.quantity, 2)
assert.equal(order?.unitPrice, 5)
assert.equal(order?.paymentStatus, "confirmed")
assert.equal(mapMarketplaceOrderRecord({ listingId: "listing-1" }, fixedNow), null)

console.log("PASS 42 marketplace record mapper runtime tests: 16 assertions")
