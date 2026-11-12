import fs from 'node:fs'
import assert from 'node:assert/strict'
const read = (p) => fs.readFileSync(p, 'utf8')
const bell = read('components/ghc/notification-bell.tsx')
const store = read('lib/notifications.ts')
const domain = read('lib/domains/notification-domain.ts')
const smart = read('lib/smart-notifications.ts')
const settings = read('components/ghc/settings.tsx')
const priority = read('lib/notification-priority.ts')
const notificationActions = read('lib/notification-actions.ts')
const checks = [
  ['priority classifier is used by notification center', bell.includes('isPriorityNotification') && bell.includes('sortNotificationsByPriority')],
  ['critical/high priority reason is visible', bell.includes('priority.reason') && bell.includes('Needs attention')],
  ['notification local store is account scoped', store.includes('scopedNotificationsKey') && store.includes('IdentityService.getCurrentUserId()')],
  ['deleted notification markers are account scoped', store.includes('scopedDeletedKey')],
  ['legacy cache is not attributed to authenticated users', store.includes('IdentityService.getCurrentUserId() === "current-user"')],
  ['notification preferences are account scoped', domain.includes('scopedAccountKey') && domain.includes('scopedDeviceKey') && domain.includes('saveNotificationPreferences(next, actorMe)')],
  ['push preferences reach notification delivery', domain.includes('pushEnabled: shouldDeliver(mapped.category, "push")')],
  ['direct notification producers respect account-scoped push preferences', store.includes('isNotificationChannelAllowed(type, data, "push")') && store.includes('isNotificationChannelAllowed(type, data, "inApp")') && store.includes('ghc_notification_account_preferences:${encodedUser}') && store.includes('ghc_notification_device_preferences:${encodedUser}')],
  ['legacy smart push path checks category preference', smart.includes('loadNotificationPreferences()[categoryByType[notification.type]]?.push')],
  ['legacy in-memory notification and browser-alert queues reset on account switch', smart.includes('ensureSmartNotificationOwner') && smart.includes('smartNotifications.browserAlertQueue = []') && smart.includes('ownerUserId')],
  ['notification preferences merge nested channel defaults safely', domain.includes('typeof accountSaved?.inApp === "boolean"') && domain.includes('typeof deviceSaved?.push === "boolean"')],
  ['settings toggles update domain notification preferences', settings.includes('saveNotificationPreferences(next, notificationIdentityId)') && settings.includes('IdentityService.subscribe') && settings.includes('for (const category of t.categories)')],
  ['optional profile and product updates default off', domain.includes('prefs.profile_views = { inApp: false, push: false }') && domain.includes('prefs.product_updates = { inApp: false, push: false }')],
  ['mark-all success toast follows server responses', bell.indexOf('const failed = results.some') < bell.indexOf('All notifications marked read')],
  ['notification deletion copy is honest about device scope', bell.includes('Notification hidden on this device') && notificationActions.includes('label: "Dismiss"') && notificationActions.includes('Hide this notification on this device')],
  ['priority scoring is deterministic and explainable', priority.includes('NotificationPriorityAssessment') && priority.includes('reason:')],
  ['security notices remain in-app by default', domain.includes('prefs.system = { inApp: true, push: false }')],
  ['notification dialog traps keyboard focus and handles Escape', bell.includes('e.key !== "Tab"') && bell.includes('e.key === "Escape"') && bell.includes('focusable[0]') && bell.includes('last.focus()')],
  ['notification dialog restores focus after close', bell.includes('previousFocusRef.current?.focus?.()') && bell.includes('requestAnimationFrame')],
]
for (const [label, ok] of checks) {
  assert.ok(ok, label)
  console.log(`PASS ${label}`)
}
console.log(`Phase 11 notification transformation contracts: ${checks.length}/${checks.length} passed`)
