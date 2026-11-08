import assert from "node:assert/strict"
import {
  addMarketplaceCartItem,
  getMarketplaceCart,
  getMarketplaceCartUnitCount,
  removeMarketplaceCartItemsByIds,
  updateMarketplaceCartQuantity,
} from "../lib/marketplace/cart.ts"

const store = new Map()
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail }
}
globalThis.window = {
  localStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
  },
  dispatchEvent: () => true,
}

const item = (listingId, overrides = {}) => ({
  listingId, quantity: 1, title: `Listing ${listingId}`, price: 12.5,
  currency: "GHC", sellerId: `seller-${listingId}`, availability: 8, ...overrides,
})

store.set("gh_marketplace_cart_v1", JSON.stringify([
  item("a", { quantity: 2 }),
  item("a", { quantity: 3 }),
  { listingId: "broken" },
  item("bad-price", { price: Infinity }),
  item("bad-qty", { quantity: -2 }),
]))
let cart = getMarketplaceCart()
assert.equal(cart.length, 1, "invalid lines are removed and duplicate listing ids are merged")
assert.equal(cart[0].quantity, 5, "duplicate quantities merge within stock and quantity caps")
assert.equal(getMarketplaceCartUnitCount(cart), 5, "unit count uses normalized quantities")

addMarketplaceCartItem(item("b", { quantity: 3, availability: 2 }))
cart = getMarketplaceCart()
assert.equal(cart.find((line) => line.listingId === "b")?.quantity, 2, "add quantity is capped by known stock")

updateMarketplaceCartQuantity("b", 50)
cart = getMarketplaceCart()
assert.equal(cart.find((line) => line.listingId === "b")?.quantity, 2, "quantity updates remain stock bounded")

// Same listing can now hold separate SKU lines without merging quantities.
addMarketplaceCartItem(item("sku-listing", { variantId: "sku-small", variantSku: "TEE-S", variantLabel: "Small", availability: 4 }))
addMarketplaceCartItem(item("sku-listing", { variantId: "sku-large", variantSku: "TEE-L", variantLabel: "Large", availability: 6 }))
addMarketplaceCartItem(item("sku-listing", { variantId: "sku-small", variantSku: "TEE-S", variantLabel: "Small", quantity: 2, availability: 4 }))
cart = getMarketplaceCart()
assert.equal(cart.filter((line) => line.listingId === "sku-listing").length, 2, "different SKU variants remain separate cart lines")
assert.equal(cart.find((line) => line.variantId === "sku-small")?.quantity, 3, "same SKU variant quantities consolidate")
updateMarketplaceCartQuantity("sku-listing", 5, "sku-large")
cart = getMarketplaceCart()
assert.equal(cart.find((line) => line.variantId === "sku-large")?.quantity, 5, "quantity edits target only the selected SKU")
assert.equal(cart.find((line) => line.variantId === "sku-small")?.quantity, 3, "other SKU quantity is unchanged")
addMarketplaceCartItem(item("c"))
removeMarketplaceCartItemsByIds(["a", "c", "sku-listing"])
cart = getMarketplaceCart()
assert.deepEqual(cart.map((line) => line.listingId), ["b"], "checkout cleanup removes only reserved ids")

store.set("gh_marketplace_cart_v1", JSON.stringify(Array.from({ length: 140 }, (_, i) => item(`line-${i}`))))
cart = getMarketplaceCart()
assert.equal(cart.length, 100, "cart storage is bounded to 100 unique lines")

console.log("Phase 4 marketplace cart runtime: 12/12 assertions PASS")
