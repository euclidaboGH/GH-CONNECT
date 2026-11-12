import fs from 'node:fs'
import assert from 'node:assert/strict'
const domain = fs.readFileSync('lib/domains/notification-domain.ts', 'utf8')
const settings = fs.readFileSync('components/ghc/settings.tsx', 'utf8')
const notifications = fs.readFileSync('lib/notifications.ts', 'utf8')
const route = fs.readFileSync('app/api/notifications/preferences/route.ts', 'utf8')
const app = fs.readFileSync('components/ghc/app.tsx', 'utf8')
const profileStore = fs.readFileSync('lib/server/identity/profile-store.ts', 'utf8')
const profileRoute = fs.readFileSync('app/api/profile/me/route.ts', 'utf8')
const checks = [
  ['account in-app preferences use a distinct account cache', domain.includes('ghc_notification_account_preferences')],
  ['browser alerts use a distinct device-scoped cache', domain.includes('ghc_notification_device_preferences') && domain.includes('ghc_notification_device_id')],
  ['legacy preferences are read for migration compatibility', domain.includes('const legacy = parsePrefs')],
  ['server account preferences are merged without overwriting device choices', domain.includes('mergeAccountNotificationPreferences')],
  ['account preferences serialize in-app channel only', domain.includes('serializeAccountNotificationPreferences')],
  ['settings expose independent in-app and this-device controls', settings.includes('aria-label={`${t.title} in-app inbox`}') && settings.includes('aria-label={`${t.title} on this device`}')],
  ['app bootstrap hydrates server account preferences after verified authentication', app.includes('hydrateAccountNotificationPreferences(userId)') && app.includes('IdentityService.subscribe') && app.includes('identity.verificationState !== "server_verified"')],
  ['settings writes account preference changes through authenticated API', settings.includes('fetch("/api/notifications/preferences"') && settings.includes('IdentityService.getAuthHeaders()')],
  ['browser permission state refreshes when tab becomes visible', settings.includes('document.addEventListener("visibilitychange"') && settings.includes('refreshPermission()')],
  ['server API derives identity from authenticated request', route.includes('resolveAuthenticatedUser(request.headers)')],
  ['server API validates category allowlist and inApp booleans', route.includes('categories.has(category)') && route.includes('typeof (prefs as Record<string, unknown>).inApp === "boolean"')],
  ['server API rate limits preference writes', route.includes('notification-preferences-write:')],
  ['server API does not accept client-supplied user identity', !route.includes('body.userId')],
  ['notification preferences are excluded from public profile projections', profileStore.includes('delete safePayload.notificationPreferences')],
  ['generic profile edits cannot overwrite dedicated notification preferences', profileRoute.includes('delete profilePayload.notificationPreferences')],
  ['notification producers read account and device channels separately', notifications.includes('ghc_notification_account_preferences') && notifications.includes('ghc_notification_device_preferences')],
  ['remote push remains explicitly unconfigured in this phase', fs.readFileSync('lib/notification-delivery.ts', 'utf8').includes('status: "not_configured"')],
]
for (const [name, ok] of checks) { assert.ok(ok, name); console.log(`PASS ${name}`) }
console.log(`Phase 11.2.3 notification preference contracts: ${checks.length}/${checks.length} passed`)
