#!/usr/bin/env node
import assert from 'node:assert/strict'
import { formatServicePrice, normalizeServiceDirectoryListing } from '../lib/ecosystem/services-directory.ts'

const valid = { id: 'svc_001', kind: 'service', status: 'active', title: 'Verified tutoring', description: 'One-to-one tutoring', category: 'Education', price: 12.5, currency: 'PI', location: 'Jos' }
assert.deepEqual(normalizeServiceDirectoryListing(valid), { id: 'svc_001', title: 'Verified tutoring', description: 'One-to-one tutoring', category: 'Education', price: 12.5, currency: 'PI', location: 'Jos' })
assert.equal(normalizeServiceDirectoryListing({ ...valid, kind: 'product' }), null)
assert.equal(normalizeServiceDirectoryListing({ ...valid, status: 'draft' }), null)
assert.equal(normalizeServiceDirectoryListing({ ...valid, price: -1 }), null)
assert.equal(normalizeServiceDirectoryListing({ ...valid, price: '12.5' }), null)
assert.equal(normalizeServiceDirectoryListing({ ...valid, currency: 'USD' }), null)
assert.equal(normalizeServiceDirectoryListing({ ...valid, id: '../bad' }), null)
assert.equal(normalizeServiceDirectoryListing({ ...valid, title: ' ' }), null)
assert.equal(normalizeServiceDirectoryListing({ ...valid, category: 'unsafe,category' }), null)
assert.equal(normalizeServiceDirectoryListing({ ...valid, description: 'A\u0000unsafe description' })?.description, 'A unsafe description')
assert.equal(formatServicePrice(12.5, 'PI'), '12.5 PI')
assert.equal(formatServicePrice(0, 'GHC'), '0 GHC')
console.log('Services directory contract: 12/12 passed')
