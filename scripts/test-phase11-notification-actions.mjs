import assert from 'node:assert/strict'
import { resolveNotificationActions } from '../lib/notification-actions.ts'

const base = {
  id: 'notice-1', type: 'system', title: 'Account notice', message: 'Review your account',
  icon: '', timestamp: 1, read: false, data: { deepLink: { open: 'settings', tab: 'settings', section: 'security' } },
}
const ids = (notification, options) => resolveNotificationActions(notification, options).map((action) => action.id)

assert.deepEqual(ids(base), ['open', 'mark_read', 'dismiss'])
assert.deepEqual(ids({ ...base, read: true }), ['open', 'dismiss'])
assert.deepEqual(ids({ ...base, read: true }, { retryAvailable: true }), ['open', 'retry', 'dismiss'])
assert.equal(resolveNotificationActions(base)[0].label, 'Review account notice')
assert.equal(resolveNotificationActions({ ...base, data: { deepLink: { open: 'wallet', tab: 'wallet', section: 'transaction' } } })[0].label, 'View transaction')
assert.equal(resolveNotificationActions({ ...base, data: { deepLink: { open: 'chat', tab: 'messages', section: 'conversation' } } })[0].label, 'Open message')
assert.equal(resolveNotificationActions({ ...base, data: { deepLink: { open: 'feed', tab: 'home', section: 'post', postId: 'post-1' } } })[0].label, 'View post')
assert.equal(resolveNotificationActions(base).at(-1).description, 'Hide this notification on this device')
console.log('Phase 11.2.1 notification action contract: 8/8 passed')
