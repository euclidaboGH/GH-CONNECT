#!/usr/bin/env node
/**
 * Run #265: deterministic Pi earnings payout recovery simulation.
 * Uses isolated in-memory fixtures only. No Pi SDK, network, Supabase, wallet,
 * provider payment, or production ledger is contacted or mutated.
 */
import assert from 'node:assert/strict'

const atomic = 10_000_000n
const fixture = (overrides = {}) => ({
  id: 'fixture-payout-001', userId: 'fixture-user-001', piUid: 'fixture-pi-uid-001',
  grossAtomic: atomic, netAtomic: 9_700_000n, network: 'Pi Testnet',
  status: 'reserved', executionAttempts: 0, executionStarted: false,
  providerPaymentId: null, txid: null, receipt: null, reserveEntries: 1,
  releaseEntries: 0, settlementEntries: 0, ...overrides,
})

function releaseIfProvenUnstarted(row, providerEvidence) {
  if (row.status === 'released' && row.releaseEntries === 1) return { ok: true, duplicate: true, status: row.status }
  const safe = row.status === 'reserved' && row.executionAttempts === 0 &&
    row.executionStarted === false && !row.providerPaymentId && !row.txid &&
    providerEvidence?.exactRequestChecked === true &&
    providerEvidence?.paymentExists === false && providerEvidence?.authoritative === true
  if (!safe) return { ok: false, error: 'RELEASE_NOT_PROVEN_SAFE' }
  if (row.releaseEntries > 0) return { ok: true, duplicate: true, status: row.status }
  row.releaseEntries += 1
  row.status = 'released'
  return { ok: true, status: row.status }
}

function reconcileUncertain(row, evidence) {
  if (row.status !== 'uncertain') return { ok: false, error: 'REQUEST_NOT_UNCERTAIN' }
  if (!evidence || evidence.authoritative !== true || evidence.exactRequestMatch !== true)
    return { ok: false, error: 'PROVIDER_MATCH_REQUIRED' }
  if (evidence.paymentExists !== true || !evidence.providerPaymentId)
    return { ok: false, error: 'NO_REPLACEMENT_PAYMENT_ALLOWED' }
  if (evidence.requestId !== row.id || evidence.piUid !== row.piUid ||
      evidence.amountAtomic !== row.netAtomic || evidence.network !== row.network)
    return { ok: false, error: 'PROVIDER_BINDING_MISMATCH' }
  row.providerPaymentId = evidence.providerPaymentId
  row.status = 'processing'
  return { ok: true, status: row.status, resumedPaymentId: row.providerPaymentId }
}

function settleVerified(row, receipt) {
  if (row.status === 'paid' && row.settlementEntries === 1) return { ok: true, duplicate: true, status: row.status }
  const valid = row.status === 'processing' && receipt &&
    receipt.providerPaymentId === row.providerPaymentId && receipt.requestId === row.id &&
    receipt.piUid === row.piUid && receipt.amountAtomic === row.netAtomic &&
    receipt.network === row.network && receipt.direction === 'app_to_user' &&
    receipt.transactionVerified === true && receipt.developerCompleted === true &&
    typeof receipt.txid === 'string' && receipt.txid.length >= 8 &&
    receipt.toAddressMatches === true
  if (!valid) return { ok: false, error: 'PROVIDER_RECEIPT_MISMATCH' }
  if (row.settlementEntries > 0) return { ok: true, duplicate: true, status: row.status }
  row.settlementEntries += 1
  row.status = 'paid'
  row.txid = receipt.txid
  row.receipt = receipt
  return { ok: true, status: row.status }
}

const tests = []
const test = (name, fn) => tests.push([name, fn])
test('provider timeout after execution attempt preserves the reservation', () => {
  const row = fixture({ status: 'uncertain', executionAttempts: 1, executionStarted: true })
  const result = releaseIfProvenUnstarted(row, { authoritative: true, exactRequestChecked: true, paymentExists: false })
  assert.equal(result.ok, false); assert.equal(row.status, 'uncertain'); assert.equal(row.releaseEntries, 0)
})
test('unstarted reservation releases only after exact authoritative no-payment proof', () => {
  const row = fixture()
  const result = releaseIfProvenUnstarted(row, { authoritative: true, exactRequestChecked: true, paymentExists: false })
  assert.equal(result.ok, true); assert.equal(row.status, 'released'); assert.equal(row.releaseEntries, 1)
})
test('absence of provider lookup evidence never releases funds', () => {
  const row = fixture()
  assert.equal(releaseIfProvenUnstarted(row, null).ok, false)
  assert.equal(row.status, 'reserved')
})
test('non-authoritative provider response never releases funds', () => {
  const row = fixture()
  assert.equal(releaseIfProvenUnstarted(row, { authoritative: false, exactRequestChecked: true, paymentExists: false }).ok, false)
  assert.equal(row.status, 'reserved')
})
test('release operation is idempotent and cannot append a second release', () => {
  const row = fixture()
  const proof = { authoritative: true, exactRequestChecked: true, paymentExists: false }
  assert.equal(releaseIfProvenUnstarted(row, proof).ok, true)
  assert.equal(releaseIfProvenUnstarted(row, proof).ok, true)
  assert.equal(row.releaseEntries, 1)
})
test('uncertain request resumes only the exact matching incomplete payment', () => {
  const row = fixture({ status: 'uncertain', executionAttempts: 1, executionStarted: true })
  const result = reconcileUncertain(row, { authoritative: true, exactRequestMatch: true, paymentExists: true,
    providerPaymentId: 'provider-fixture-001', requestId: row.id, piUid: row.piUid,
    amountAtomic: row.netAtomic, network: row.network })
  assert.equal(result.ok, true); assert.equal(row.status, 'processing')
  assert.equal(row.providerPaymentId, 'provider-fixture-001')
})
test('uncertain request never creates a replacement when provider match is absent', () => {
  const row = fixture({ status: 'uncertain', executionAttempts: 1, executionStarted: true })
  const result = reconcileUncertain(row, { authoritative: true, exactRequestMatch: true, paymentExists: false })
  assert.equal(result.ok, false); assert.equal(result.error, 'NO_REPLACEMENT_PAYMENT_ALLOWED')
  assert.equal(row.providerPaymentId, null); assert.equal(row.status, 'uncertain')
})
test('provider request ID mismatch blocks recovery', () => {
  const row = fixture({ status: 'uncertain', executionAttempts: 1, executionStarted: true })
  const result = reconcileUncertain(row, { authoritative: true, exactRequestMatch: true, paymentExists: true,
    providerPaymentId: 'provider-fixture-001', requestId: 'different-request', piUid: row.piUid,
    amountAtomic: row.netAtomic, network: row.network })
  assert.equal(result.error, 'PROVIDER_BINDING_MISMATCH')
})
test('recipient mismatch blocks recovery', () => {
  const row = fixture({ status: 'uncertain', executionAttempts: 1, executionStarted: true })
  const result = reconcileUncertain(row, { authoritative: true, exactRequestMatch: true, paymentExists: true,
    providerPaymentId: 'provider-fixture-001', requestId: row.id, piUid: 'other-pi-uid',
    amountAtomic: row.netAtomic, network: row.network })
  assert.equal(result.error, 'PROVIDER_BINDING_MISMATCH')
})
test('amount mismatch blocks recovery', () => {
  const row = fixture({ status: 'uncertain', executionAttempts: 1, executionStarted: true })
  const result = reconcileUncertain(row, { authoritative: true, exactRequestMatch: true, paymentExists: true,
    providerPaymentId: 'provider-fixture-001', requestId: row.id, piUid: row.piUid,
    amountAtomic: row.netAtomic + 1n, network: row.network })
  assert.equal(result.error, 'PROVIDER_BINDING_MISMATCH')
})
test('settlement requires verified, developer-completed, exact-destination receipt', () => {
  const row = fixture({ status: 'processing', providerPaymentId: 'provider-fixture-001' })
  const receipt = { providerPaymentId: row.providerPaymentId, requestId: row.id, piUid: row.piUid,
    amountAtomic: row.netAtomic, network: row.network, direction: 'app_to_user',
    transactionVerified: true, developerCompleted: true, txid: 'fixture-txid-12345678', toAddressMatches: true }
  assert.equal(settleVerified(row, receipt).ok, true); assert.equal(row.status, 'paid')
})
test('settlement rejects unverified or wrong-destination receipt', () => {
  for (const patch of [{ transactionVerified: false }, { developerCompleted: false }, { toAddressMatches: false }]) {
    const row = fixture({ status: 'processing', providerPaymentId: 'provider-fixture-001' })
    const receipt = { providerPaymentId: row.providerPaymentId, requestId: row.id, piUid: row.piUid,
      amountAtomic: row.netAtomic, network: row.network, direction: 'app_to_user',
      transactionVerified: true, developerCompleted: true, txid: 'fixture-txid-12345678', toAddressMatches: true, ...patch }
    assert.equal(settleVerified(row, receipt).ok, false); assert.equal(row.status, 'processing')
    assert.equal(row.settlementEntries, 0)
  }
})
test('settlement cannot post twice', () => {
  const row = fixture({ status: 'processing', providerPaymentId: 'provider-fixture-001' })
  const receipt = { providerPaymentId: row.providerPaymentId, requestId: row.id, piUid: row.piUid,
    amountAtomic: row.netAtomic, network: row.network, direction: 'app_to_user',
    transactionVerified: true, developerCompleted: true, txid: 'fixture-txid-12345678', toAddressMatches: true }
  assert.equal(settleVerified(row, receipt).ok, true)
  assert.equal(settleVerified(row, receipt).ok, true)
  assert.equal(row.settlementEntries, 1)
})

for (const [name, fn] of tests) { fn(); console.log(`PASS ${name}`) }
console.log(`\nRun #265 isolated payout recovery simulation: ${tests.length}/${tests.length} passed.`)
