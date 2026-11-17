import assert from "node:assert/strict"
import { sortMarketplaceListings } from "../lib/marketplace/order-lifecycle.ts"

const rows = [
  { id: "ghc-high", currency: "GHC", price: 900, createdAt: 30 },
  { id: "pi-low", currency: "PI", price: 0.2, createdAt: 20 },
  { id: "ghc-low", currency: "GHC", price: 10, createdAt: 10 },
  { id: "pi-high", currency: "PI", price: 8, createdAt: 40 },
  { id: "ghc-mid", currency: "GHC", price: 250, createdAt: 25 },
]

assert.deepEqual(
  sortMarketplaceListings(rows, "price_asc").map((row) => row.id),
  ["ghc-low", "ghc-mid", "ghc-high", "pi-low", "pi-high"],
  "GHC and PI amounts must be sorted independently, never compared as one numeric scale",
)
assert.deepEqual(
  sortMarketplaceListings(rows, "price_desc").map((row) => row.id),
  ["ghc-high", "ghc-mid", "ghc-low", "pi-high", "pi-low"],
)
assert.deepEqual(
  sortMarketplaceListings(rows, "newest").map((row) => row.id),
  ["pi-high", "ghc-high", "ghc-mid", "pi-low", "ghc-low"],
)

console.log("PASS Phase 3 marketplace currency-aware sorting: 3 cases")
