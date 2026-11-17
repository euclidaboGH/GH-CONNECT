#!/usr/bin/env node
import fs from "node:fs"
const read = (p) => fs.readFileSync(p, "utf8")
const screen = read("components/ghc/marketplace-screen.tsx")
const route = read("app/api/marketplace/listings/route.ts")
const store = read("lib/server/marketplace/listing-store.ts")
const helper = read("lib/marketplace/product-options.ts")
const client = read("lib/social/client.ts")
const checks = [
  ["Seller Centre exposes low-stock and listing-quality indicators", screen.includes("lowStockListings") && screen.includes("incompleteListings")],
  ["Seller option authoring clearly separates informational options from true SKU pricing", screen.includes("Product options (informational)") && screen.includes("use SKU variants below for independent prices and inventory")],
  ["Product options are persisted in listing metadata", store.includes("meta.productOptions = productOptions")],
  ["Product options round-trip through listing server mapping", store.includes("productOptions,") && store.includes("productOptions: l.productOptions || []")],
  ["API preserves options on omitted edits and rejects malformed supplied data", route.includes("existing?.productOptions || []") && route.includes("INVALID_PRODUCT_OPTIONS")],
  ["Seller API contract includes product options", client.includes("productOptions?: Array<{ name: string; values: string[] }>")],
  ["Buyer detail discloses options are informational and shared-stock", screen.includes("Options share the listed price and stock") && screen.includes("Ask seller about options")],
  ["Product option parser limits groups and value counts", helper.includes("lines.length > 4") && helper.includes("values.length > 12")],
  ["No variant-specific price or inventory is implied by the current model", helper.includes("descriptive product options") && helper.includes("share the listing's authoritative price and stock")],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++ }
console.log(`\nPhase 9.2 Seller Centre contracts: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
