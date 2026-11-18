import assert from 'node:assert/strict'
import { IdentityService } from '../lib/identity/identity-service.ts'
import {
  defaultNotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences,
  mergeAccountNotificationPreferences,
  serializeAccountNotificationPreferences,
} from '../lib/domains/notification-domain.ts'

const store = new Map()
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}
globalThis.crypto ||= { randomUUID: () => 'device-one' }
IdentityService.setFromPi({ uid: 'pref-alpha', verifiedByServer: true })
let prefs = defaultNotificationPreferences()
prefs.messages = { inApp: false, push: true }
prefs.rewards = { inApp: true, push: false }
saveNotificationPreferences(prefs, 'pref-alpha')
let loaded = loadNotificationPreferences('pref-alpha')
assert.equal(loaded.messages.inApp, false, 'account-level in-app choice persists')
assert.equal(loaded.messages.push, true, 'device-level browser alert choice persists')
assert.equal(loaded.rewards.push, false, 'device-level category opt-out persists')

// A second device has no inherited browser alert choices, but receives account preferences.
store.set('ghc_notification_device_id', 'device-two')
loaded = loadNotificationPreferences('pref-alpha')
assert.equal(loaded.messages.push, true, 'new device uses its own independent default')
loaded = mergeAccountNotificationPreferences(loaded, {
  messages: { inApp: false },
  rewards: { inApp: true },
}, 'pref-alpha')
assert.equal(loaded.messages.inApp, false, 'server account preference hydrates on another device')
assert.equal(loaded.messages.push, true, 'account sync does not overwrite device alert choice')
assert.equal(loaded.rewards.inApp, true)
assert.equal(serializeAccountNotificationPreferences(loaded).messages.inApp, false)

// Account boundaries remain separate even on a shared browser.
IdentityService.setFromPi({ uid: 'pref-beta', verifiedByServer: true })
const beta = loadNotificationPreferences('pref-beta')
assert.equal(beta.messages.inApp, true, 'second account does not inherit alpha account preference')
assert.equal(beta.messages.push, true, 'second account has its own device-scoped alert preference')
IdentityService.setFromPi({ uid: 'pref-alpha', verifiedByServer: true })
assert.equal(loadNotificationPreferences('pref-alpha').messages.inApp, false)
console.log('Phase 11.2.3 notification preference runtime tests: 12/12 passed')
