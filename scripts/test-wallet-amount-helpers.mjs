import assert from 'node:assert/strict'
import * as pi from '../lib/wallet/pi-amount.ts'
import * as g from '../lib/wallet/ghc-amount.ts'
let n = 0
const t = (name, fn) => { fn(); n += 1; console.log(`ok - ${name}`) }
t('pi exact parse', () => assert.deepEqual(pi.parsePiInput('3'), { ok: true, atomic: 30000000 }))
t('pi 0.1 exact (no float drift)', () => assert.equal(pi.parsePiInput('0.1').atomic, 1000000))
t('pi 2.95 exact', () => assert.equal(pi.parsePiInput('2.95').atomic, 29500000))
t('pi 7 decimals ok', () => assert.equal(pi.parsePiInput('0.0000001').atomic, 1))
t('pi 8 decimals rejected', () => assert.equal(pi.parsePiInput('0.00000001').code, 'TOO_MANY_DECIMALS'))
t('pi rejects exponent/sign', () => { assert.equal(pi.parsePiInput('1e3').code, 'INVALID'); assert.equal(pi.parsePiInput('-1').code, 'INVALID') })
t('pi rejects empty/zero/dot', () => { assert.equal(pi.parsePiInput('').code, 'EMPTY'); assert.equal(pi.parsePiInput('0').code, 'NOT_POSITIVE'); assert.equal(pi.parsePiInput('.').code, 'INVALID') })
t('pi accepts comma grouping & leading dot', () => { assert.equal(pi.parsePiInput('1,000').atomic, 10000000000); assert.equal(pi.parsePiInput('.5').atomic, 5000000) })
t('pi unsafe huge rejected', () => assert.equal(pi.parsePiInput('99999999999999999999').code, 'TOO_LARGE'))
t('pi atomic->string', () => { assert.equal(pi.atomicToPiString(30000000), '3'); assert.equal(pi.atomicToPiString(29500000), '2.95'); assert.equal(pi.atomicToPiString(-5), '0') })
t('pi floor never rounds up', () => assert.equal(pi.floorPiToAtomic(2.99999999), 29999999))
t('pi max capped by single payout', () => { assert.equal(pi.maxWithdrawAtomic(5e9, 1e9), 1e9); assert.equal(pi.maxWithdrawAtomic(5e8, 1e9), 5e8); assert.equal(pi.maxWithdrawAtomic(NaN), 0) })
t('ghc exact parse 4dp', () => { assert.equal(g.parseGhcInput('12.3456').units, 123456); assert.equal(g.parseGhcInput('0.1').units, 1000) })
t('ghc 5 decimals rejected', () => assert.equal(g.parseGhcInput('1.00001').code, 'TOO_MANY_DECIMALS'))
t('ghc rejects bad input', () => { assert.equal(g.parseGhcInput('1e2').code, 'INVALID'); assert.equal(g.parseGhcInput('').code, 'EMPTY'); assert.equal(g.parseGhcInput('0').code, 'NOT_POSITIVE') })
t('ghc floor', () => { assert.equal(g.floorGhc(10.99999), 10.9999); assert.equal(g.floorGhc(-1), 0) })
t('ghc->pi preview floored 100:1', () => { assert.equal(g.ghcToPiPreview(100, 100), 1); assert.equal(g.ghcToPiPreview(1, 3), 0.3333333) })
t('pi address shape', () => { assert.ok(g.looksLikePiWalletAddress('G' + 'A'.repeat(55))); assert.ok(!g.looksLikePiWalletAddress('abc')) })
t('ghc format no negative zero', () => { assert.equal(g.formatGhcSafe(-0.001).includes('−'), false); assert.ok(g.formatGhcSafe(-5).startsWith('−')) })
t('withdrawal status labels', () => { assert.equal(g.withdrawalStatusLabel('pending'), 'Awaiting review'); assert.equal(g.withdrawalStatusLabel('x'), 'X') })
console.log(`wallet amount helpers: ${n}/${n} passed`)
