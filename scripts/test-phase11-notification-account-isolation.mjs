import assert from 'node:assert/strict'
import { IdentityService } from '../lib/identity/identity-service.ts'
import { notificationSystem } from '../lib/notifications.ts'

const data = new Map()
globalThis.localStorage = {
  getItem: (key) => data.has(key) ? data.get(key) : null,
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key),
}
let browserAlertCount = 0
class MockNotification {
  static permission = 'granted'
  constructor() { browserAlertCount += 1 }
}
globalThis.Notification = MockNotification
globalThis.window = {
  Notification: MockNotification,
  dispatchEvent: () => true,
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail } },
}

IdentityService.setFromPi({ uid: 'account-alpha', verifiedByServer: true })
localStorage.setItem('ghc_notification_preferences:account-alpha', JSON.stringify({ messages: { inApp: true, push: false } }))
notificationSystem.addNotification('message', 'Alpha message', 'Private to alpha', 'bell')
assert.equal(notificationSystem.getNotifications().length, 1)
assert.equal(browserAlertCount, 0, 'account push opt-out must suppress browser alerts')
localStorage.setItem('ghc_notification_preferences:account-alpha', JSON.stringify({ messages: { inApp: true, push: true } }))
notificationSystem.addNotification('message', 'Alpha second message', 'Push allowed', 'bell')
assert.equal(browserAlertCount, 1, 'account push opt-in permits browser alerts')
notificationSystem.addNotification('message', 'Alpha private message', 'Explicit suppression', 'bell', { pushEnabled: false })
assert.equal(browserAlertCount, 1, 'explicit push opt-out overrides stored preference')
localStorage.setItem('ghc_notification_preferences:account-alpha', JSON.stringify({ messages: { inApp: true, push: false }, rewards: { inApp: false, push: true } }))
notificationSystem.addNotification('reward', 'Push-only reward', 'No in-app row', 'gift')
assert.equal(browserAlertCount, 2, 'push can remain enabled independently of in-app delivery')
assert.equal(notificationSystem.getNotifications().length, 3, 'in-app opt-out prevents a local notification row')

IdentityService.setFromPi({ uid: 'account-beta', verifiedByServer: true })
assert.equal(notificationSystem.getNotifications().length, 0, 'beta must not see alpha local notifications')
notificationSystem.addNotification('message', 'Beta message', 'Beta defaults are independent', 'bell')
assert.equal(browserAlertCount, 3, 'beta defaults do not inherit alpha push opt-out')
notificationSystem.addNotification('reward', 'Beta reward', 'Private to beta', 'gift', { pushEnabled: false })
assert.equal(notificationSystem.getNotifications().length, 2)

IdentityService.setFromPi({ uid: 'account-alpha', verifiedByServer: true })
assert.equal(notificationSystem.getNotifications().length, 3)
assert.equal(notificationSystem.getNotifications()[0].title, 'Alpha message')
notificationSystem.addNotification('message', 'Alpha preference still off', 'Account alpha only', 'bell')
assert.equal(browserAlertCount, 3, 'alpha preference remains isolated after switching back')
assert.equal(notificationSystem.getNotifications().length, 4)
const alphaId = notificationSystem.getNotifications()[0].id
notificationSystem.deleteNotification(alphaId)
assert.equal(notificationSystem.isDeleted(alphaId), true, 'dismissed marker is scoped and persisted for alpha')

IdentityService.setFromPi({ uid: 'account-beta', verifiedByServer: true })
assert.equal(notificationSystem.getNotifications().some((item) => item.title === 'Beta reward'), true)
assert.equal(notificationSystem.getNotifications().some((item) => item.title === 'Beta message'), true)
assert.equal(notificationSystem.isDeleted(alphaId), false, 'beta cannot inherit alpha dismissed markers')
console.log('Phase 11 account-isolation runtime tests: 16/16 passed')
