import assert from "node:assert/strict"
import { getNotificationDeliveryCapabilities, canAttemptBrowserAlert } from "../lib/notification-delivery.ts"
const originalWindow = globalThis.window
const originalNavigator = globalThis.navigator
try {
  delete globalThis.window
  delete globalThis.navigator
  let caps = getNotificationDeliveryCapabilities()
  assert.equal(caps.browserAlerts.permission, "unsupported")
  assert.equal(caps.remoteWebPush.status, "not_configured")
  assert.equal(caps.remoteWebPush.receiverPresent, true)
  assert.equal(canAttemptBrowserAlert(caps), false)

  globalThis.window = { Notification: { permission: "granted" } }
  globalThis.navigator = { serviceWorker: {} }
  caps = getNotificationDeliveryCapabilities()
  assert.equal(caps.browserAlerts.supported, true)
  assert.equal(caps.browserAlerts.permission, "granted")
  assert.equal(caps.browserAlerts.serviceWorkerSupported, true)
  assert.equal(caps.browserAlerts.delivery, "local_only")
  assert.equal(canAttemptBrowserAlert(caps), true)

  globalThis.window = { Notification: { permission: "denied" } }
  globalThis.navigator = {}
  caps = getNotificationDeliveryCapabilities()
  assert.equal(caps.browserAlerts.permission, "denied")
  assert.equal(caps.browserAlerts.serviceWorkerSupported, false)
  assert.equal(canAttemptBrowserAlert(caps), false)
  assert.equal(caps.remoteWebPush.providerSenderPresent, false)
  console.log("Phase 11.2.2 delivery capability runtime tests: 14/14")
} finally {
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow
  if (originalNavigator === undefined) delete globalThis.navigator; else globalThis.navigator = originalNavigator
}
