/**
 * Notification delivery capability truth.
 *
 * In-app inbox persistence is server-backed through the authenticated inbox
 * APIs (with a device-local compatibility mirror). Browser alerts are local
 * display attempts made by an active app session. The service worker contains
 * a push-event receiver, but no subscription registration or provider sender
 * is configured, so remote Web Push is deliberately reported unavailable.
 */
export type NotificationDeliveryChannel = "in_app" | "browser_alert" | "remote_web_push"
export type BrowserPermissionState = "granted" | "denied" | "default" | "unsupported"

export type NotificationDeliveryCapabilities = {
  inAppInbox: "server_backed_api"
  browserAlerts: {
    supported: boolean
    permission: BrowserPermissionState
    serviceWorkerSupported: boolean
    delivery: "local_only"
  }
  remoteWebPush: {
    configured: false
    status: "not_configured"
    receiverPresent: true
    subscriptionManagementPresent: false
    providerSenderPresent: false
  }
}

export function getNotificationDeliveryCapabilities(): NotificationDeliveryCapabilities {
  const browser = typeof window !== "undefined"
  const notificationSupported = browser && "Notification" in window
  let permission: BrowserPermissionState = "unsupported"
  if (notificationSupported) {
    const value = window.Notification.permission
    permission = value === "granted" || value === "denied" ? value : "default"
  }
  return {
    inAppInbox: "server_backed_api",
    browserAlerts: {
      supported: notificationSupported,
      permission,
      serviceWorkerSupported: browser && "serviceWorker" in navigator,
      delivery: "local_only",
    },
    remoteWebPush: {
      configured: false,
      status: "not_configured",
      receiverPresent: true,
      subscriptionManagementPresent: false,
      providerSenderPresent: false,
    },
  }
}

export function canAttemptBrowserAlert(capabilities: NotificationDeliveryCapabilities): boolean {
  return capabilities.browserAlerts.supported && capabilities.browserAlerts.permission === "granted"
}
