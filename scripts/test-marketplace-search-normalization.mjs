import assert from "node:assert/strict"
import { normalizeListingSearch } from "../lib/active-upgrades/marketplace.ts"

assert.equal(normalizeListingSearch("  ＧｒｅｅｎＨａｖｅｎ   market  "), "GreenHaven market")
assert.equal(normalizeListingSearch("one\u0000two\u001fthree\u007f"), "one two three")
assert.equal(normalizeListingSearch("a\n\t\r b"), "a b")
assert.equal(normalizeListingSearch("   "), "")
assert.equal(normalizeListingSearch(null), "")
assert.equal(normalizeListingSearch(undefined), "")
assert.equal(normalizeListingSearch("x".repeat(140)).length, 100)
assert.equal(normalizeListingSearch("x".repeat(99) + "   " + "y"), "x".repeat(99))
console.log("Marketplace search normalization: 8/8 passed")
