import assert from 'node:assert/strict'
import { parseMarketplaceFulfilmentInput } from '../lib/marketplace/fulfilment.ts'
const now = Date.parse('2026-11-07T12:00:00.000Z')
let passed = 0
function check(name, fn) { fn(); passed += 1; console.log(`PASS ${name}`) }
check('rejects non-object payloads', () => assert.equal(parseMarketplaceFulfilmentInput([]).error, 'INVALID_BODY'))
check('rejects unknown actions', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'admin_refund' }).error, 'INVALID_ACTION'))
check('requires explicit fulfilment method', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill' }).error, 'FULFILMENT_METHOD_REQUIRED'))
check('rejects unsupported fulfilment methods', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'teleport' }).error, 'INVALID_FULFILMENT_METHOD'))
check('requires carrier and tracking for shipping', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'shipping', carrier: 'DHL' }).error, 'SHIPPING_DETAILS_REQUIRED'))
check('accepts complete shipping details', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'shipping', carrier: 'DHL', trackingNumber: 'ABC123', trackingUrl: 'https://dhl.com/track/ABC123' }, now).ok, true))
check('accepts pickup without shipping metadata', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'pickup' }, now).ok, true))
check('accepts digital service fulfilment', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'digital' }, now).ok, true))
check('rejects insecure tracking URLs', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'shipping', carrier: 'DHL', trackingNumber: 'ABC123', trackingUrl: 'http://dhl.com/track' }, now).error, 'INVALID_TRACKING_URL'))
check('rejects tracking URL credentials', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'shipping', carrier: 'DHL', trackingNumber: 'ABC123', trackingUrl: 'https://user:pass@dhl.com/track' }, now).error, 'INVALID_TRACKING_URL'))
check('rejects past estimated delivery outside tolerance', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'pickup', estimatedDeliveryAt: '2026-10-01T00:00:00Z' }, now).error, 'INVALID_ESTIMATED_DELIVERY'))
check('rejects excessive estimated delivery horizon', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'pickup', estimatedDeliveryAt: '2028-01-01T00:00:00Z' }, now).error, 'INVALID_ESTIMATED_DELIVERY'))
check('bounds buyer/seller note', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'buyer_confirm', note: 'x'.repeat(700) }).value.note.length, 500))
check('bounds carrier input', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_fulfill', method: 'shipping', carrier: 'C'.repeat(120), trackingNumber: 'ABC123' }).value.carrier.length, 80))
check('preserves dispatch action without client-supplied shipping state', () => assert.equal(parseMarketplaceFulfilmentInput({ action: 'seller_dispatch' }).value.action, 'seller_dispatch'))
console.log(`\nPhase 9.4 fulfilment parser: ${passed}/15 assertions passed`)
