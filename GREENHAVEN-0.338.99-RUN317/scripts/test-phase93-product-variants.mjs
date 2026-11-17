import assert from 'node:assert/strict'
import { normalizeProductVariants, parseProductVariantsText, productVariantsToText } from '../lib/marketplace/product-variants.ts'

const parsed = parseProductVariantsText('TEE-S-BLK | Small / Black | 12.50 | 8\nTEE-M-BLK | Medium / Black | 12.50 | 12', 'GHC')
assert.equal(parsed?.length, 2)
assert.equal(parsed?.[0].price, 12.5)
assert.equal(parsed?.[1].stockOnHand, 12)
assert.equal(parseProductVariantsText('SKU | Label | 1e3 | 2', 'GHC'), null)
assert.equal(parseProductVariantsText('SKU | Label | 10 | -1', 'GHC'), null)
assert.equal(parseProductVariantsText('SKU | Label | 10 | 1.5', 'GHC'), null)
assert.equal(parseProductVariantsText('SKU | Label | 10 | 1\n sku | Other | 11 | 2', 'GHC'), null)
assert.equal(parseProductVariantsText('SKU | Label | 10 | 1', 'USD'), null)
assert.equal(parseProductVariantsText(Array.from({ length: 101 }, (_, i) => `S${i} | Label ${i} | 1 | 1`).join('\n'), 'PI'), null)
const normalized = normalizeProductVariants([
  { id: 'v1', sku: 'SKU-1', label: 'Small', price: 10, currency: 'GHC', stockOnHand: 5, stockReserved: 2, available: 3 },
  { id: 'v2', sku: 'sku-1', label: 'Duplicate SKU', price: 10, currency: 'GHC', stockOnHand: 5 },
  { id: 'v3', sku: 'BAD', label: 'Bad price', price: Infinity, currency: 'GHC', stockOnHand: 1 },
  { id: 'v4', sku: 'BAD-RESERVED', label: 'Bad reserved stock', price: 5, currency: 'GHC', stockOnHand: 1, stockReserved: 2 },
])
assert.equal(normalized.length, 1)
assert.equal(normalized[0].id, 'v1')
assert.equal(normalized[0].active, true)
assert.equal(normalized[0].stockReserved, 2)
assert.equal(normalized[0].available, 3)
assert.equal(productVariantsToText(normalized), 'SKU-1 | Small | 10 | 5')
assert.equal(productVariantsToText([{ id: 'inactive', sku: 'OFF', label: 'Inactive', price: 1, currency: 'PI', stockOnHand: 1, active: false }]), '')
console.log('Phase 9.3 product variant parser/runtime: 16/16 assertions passed')
