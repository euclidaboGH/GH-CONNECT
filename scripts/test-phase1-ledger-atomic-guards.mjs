import assert from 'node:assert/strict'
import {
  PI_ATOMIC_SCALE,
  piToAtomic,
  atomicToPi,
  isValidPiAtomic,
  floorPiToAtomic,
  previewWithdrawalFeeAtomic,
} from '../lib/wallet/pi-atomic.ts'

assert.equal(PI_ATOMIC_SCALE, 10_000_000)
assert.equal(piToAtomic(1), 10_000_000)
assert.equal(piToAtomic(0.0000001), 1)
assert.equal(piToAtomic(0), 0)
assert.equal(piToAtomic(-1), 0)
assert.equal(piToAtomic(Number.MAX_SAFE_INTEGER), 0)
assert.equal(atomicToPi(10_000_000), 1)
assert.equal(atomicToPi('10000000'), 1)
assert.equal(atomicToPi('1.5'), 0)
assert.equal(atomicToPi(Number.MAX_SAFE_INTEGER + 1), 0)
assert.equal(isValidPiAtomic(1), true)
assert.equal(isValidPiAtomic(0), false)
assert.equal(isValidPiAtomic(0, true), true)
assert.equal(isValidPiAtomic(1.2), false)
assert.equal(floorPiToAtomic(0.00000019), 1)
assert.equal(floorPiToAtomic(Number.MAX_SAFE_INTEGER), 0)

const ordinary = previewWithdrawalFeeAtomic(10_000_000, 300)
assert.deepEqual(ordinary, { grossAtomic: 10_000_000, feeAtomic: 300_000, netAtomic: 9_700_000 })
const large = previewWithdrawalFeeAtomic(Number.MAX_SAFE_INTEGER, 300)
assert.equal(large.grossAtomic, Number.MAX_SAFE_INTEGER)
assert.equal(large.feeAtomic + large.netAtomic, large.grossAtomic)
assert.equal(previewWithdrawalFeeAtomic(10_000_000, 10_001).grossAtomic, 0)
assert.equal(previewWithdrawalFeeAtomic(1.5, 300).grossAtomic, 0)

console.log('Phase I PI atomic guards: 22 assertions passed')
