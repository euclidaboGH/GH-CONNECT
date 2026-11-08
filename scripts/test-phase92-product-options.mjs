import assert from "node:assert/strict"
import { normalizeProductOptions, parseProductOptionsText, productOptionsToText } from "../lib/marketplace/product-options.ts"

assert.deepEqual(parseProductOptionsText("Size: S, M, L\nColour: Black, White"), [
  { name: "Size", values: ["S", "M", "L"] },
  { name: "Colour", values: ["Black", "White"] },
])
assert.equal(parseProductOptionsText("broken line"), null)
assert.equal(parseProductOptionsText("A: 1\nB: 2\nC: 3\nD: 4\nE: 5"), null)
assert.equal(parseProductOptionsText("Size: S, S"), null, "duplicate values are rejected rather than silently collapsed")
assert.equal(parseProductOptionsText("Size: "), null)
assert.deepEqual(normalizeProductOptions([{ name: "Size", values: ["S", "M"] }]), [{ name: "Size", values: ["S", "M"] }])
assert.deepEqual(normalizeProductOptions([{ name: "Size", values: ["S", "M"] }, { name: "size", values: ["L"] }]), [{ name: "Size", values: ["S", "M"] }], "duplicate option names are normalized away at read boundary")
assert.equal(productOptionsToText([{ name: "Size", values: ["S", "M"] }]), "Size: S, M")
assert.deepEqual(normalizeProductOptions(null), [])
console.log("Phase 9.2 product option contracts: 9/9 assertions PASS")
