import assert from 'node:assert/strict'
import { TransactionManager } from '../lib/transactions.ts'

class TestManager extends TransactionManager {
  next = 0
  generateId(prefix = 'tx') { this.next += 1; return `${prefix}_${this.next}` }
}

const manager = new TestManager()
const events = []
const tx = manager.beginTransaction()
assert.equal(manager.addOperation(tx.id, { type: 'reserve', data: null, execute: () => events.push('reserve'), compensate: () => events.push('undo-reserve') }), true)
assert.equal(manager.addOperation(tx.id, { type: 'notify', data: null, execute: () => events.push('notify'), compensate: () => events.push('undo-notify') }), true)
assert.equal(await manager.commitTransaction(tx.id), true)
assert.deepEqual(events, ['reserve', 'notify'])
assert.equal(manager.getTransactionStatus(tx.id)?.status, 'committed')

const rollback = manager.beginTransaction()
manager.addOperation(rollback.id, { type: 'first', data: null, execute: () => events.push('first'), compensate: () => events.push('undo-first') })
manager.addOperation(rollback.id, { type: 'second', data: null, execute: () => { throw new Error('injected failure') }, compensate: () => events.push('undo-second') })
assert.equal(await manager.commitTransaction(rollback.id), false)
assert.equal(manager.getTransactionStatus(rollback.id)?.status, 'rolled_back')
assert.equal(events.at(-1), 'undo-first')

const unsafe = manager.beginTransaction()
manager.addOperation(unsafe.id, { type: 'unexecutable', data: null })
assert.equal(await manager.commitTransaction(unsafe.id), false)
assert.equal(manager.getTransactionStatus(unsafe.id)?.status, 'rolled_back')

const callbackOnly = await manager.executeTransaction(async () => 'tracked')
assert.equal(callbackOnly.success, true)
assert.equal(callbackOnly.data, 'tracked')
assert.equal(manager.getTransactionHistory().length, 4)
console.log('Run 313 transaction coordinator: 12/12 assertions passed')
