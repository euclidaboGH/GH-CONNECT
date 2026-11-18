import assert from 'node:assert/strict'
import { assessNotificationPriority, isPriorityNotification, sortNotificationsByPriority } from '../lib/notification-priority.ts'
import { buildAttentionSignals } from '../lib/unified-attention.ts'

const now = Date.now()
const notice = (overrides = {}) => ({
  id: 'n', type: 'like', title: 'Someone liked your post', message: 'New activity',
  icon: 'bell', timestamp: now, read: false, data: {}, ...overrides,
})

assert.equal(assessNotificationPriority(notice({ type: 'system', title: 'Security alert: password changed' })).band, 'critical')
assert.equal(assessNotificationPriority(notice({ type: 'message' })).band, 'high')
assert.equal(assessNotificationPriority(notice({ type: 'marketplace_order' })).band, 'high')
assert.equal(assessNotificationPriority(notice({ type: 'reward' })).band, 'normal')
assert.equal(assessNotificationPriority(notice({ type: 'like' })).band, 'low')
assert.equal(assessNotificationPriority(notice({ type: 'comment', title: 'Security alert: password changed' })).band, 'low')
assert.equal(isPriorityNotification(notice({ type: 'message' })), true)
assert.equal(isPriorityNotification(notice({ type: 'message', read: true })), false)
assert.equal(isPriorityNotification(notice({ type: 'like' })), false)
const sorted = sortNotificationsByPriority([
  notice({ id: 'low', type: 'like' }),
  notice({ id: 'critical', type: 'system', title: 'Security alert: password changed' }),
  notice({ id: 'high', type: 'message' }),
])
assert.deepEqual(sorted.map((x) => x.id), ['critical', 'high', 'low'])
assert.equal(assessNotificationPriority(notice({ type: 'payment', title: 'Payment failed' })).requiresAttention, true)
const signals = buildAttentionSignals([
  notice({ type: 'system', title: 'Post published', data: { open: 'feed' } }),
  notice({ type: 'system', title: 'GHC transfer failed', data: { category: 'wallet', open: 'wallet' } }),
  notice({ type: 'system', title: 'Security alert: password changed', data: { category: 'system', open: 'settings' } }),
])
assert.deepEqual(signals.map((signal) => signal.kind).sort(), ['system', 'wallet'])
assert.equal(signals.find((signal) => signal.kind === 'system')?.priority, 100)
console.log('Phase 11 notification priority runtime tests: 14/14 passed')
