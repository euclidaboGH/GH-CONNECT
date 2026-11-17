import assert from "node:assert/strict"
import { matchesFilterQuery, normalizeFilterText, countActiveFilters } from "../lib/filtering/filter-utils.ts"
import { searchUtils } from "../lib/search-utils.ts"

assert.equal(normalizeFilterText("  Café   GREENHAVEN "), "cafe greenhaven")
assert.equal(normalizeFilterText("ＧｒｅｅｎＨａｖｅｎ"), "greenhaven")
assert.equal(matchesFilterQuery("green haven", "GreenHaven marketplace"), true)
assert.equal(matchesFilterQuery("marketplace green", "GreenHaven Marketplace"), true)
assert.equal(matchesFilterQuery("tracking", "Marketplace", "Order tracking details"), true)
assert.equal(matchesFilterQuery("unknown", "Marketplace", "Order tracking details"), false)
assert.equal(matchesFilterQuery("", "anything"), true)
assert.equal(matchesFilterQuery("   ", "anything"), true)
assert.equal(matchesFilterQuery("CAFÉ", "cafe"), true)
assert.equal(matchesFilterQuery("Pi 123", "Payment", "PI-123"), true)
assert.equal(countActiveFilters(["active", "", true, false, [], ["a"], null, undefined]), 3)
const locations = [
  { id: "london", location: "London, UK" },
  { id: "yorkshire", location: "Yorkshire, UK" },
  { id: "paris", location: "Paris, France" },
]
assert.deepEqual(searchUtils.filterByLocation(locations, "London", 1).map((item) => item.id), ["london"])
assert.deepEqual(searchUtils.filterByLocation(locations, "UK", 999).map((item) => item.id), ["london", "yorkshire"])
assert.deepEqual(searchUtils.filterByLocation(locations, "York", 100).map((item) => item.id), [])
console.log("Phase 10 filtering utility tests: 14/14 passed")
