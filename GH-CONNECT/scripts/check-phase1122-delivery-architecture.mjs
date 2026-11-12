import fs from "node:fs"
import assert from "node:assert/strict"
const read = (path) => fs.readFileSync(path, "utf8")
const smart = read("lib/smart-notifications.ts")
const notifications = read("lib/notifications.ts")
const worker = read("public/sw.js")
const settings = read("components/ghc/settings.tsx")
const capabilities = read("lib/notification-delivery.ts")
const packageJson = JSON.parse(read("package.json"))
const checks = [
  ["delivery capability contract explicitly separates three channels", capabilities.includes('"in_app" | "browser_alert" | "remote_web_push"')],
  ["in-app inbox is identified as server-backed API delivery", capabilities.includes('inAppInbox: "server_backed_api"')],
  ["browser alert delivery is explicitly local-only", capabilities.includes('delivery: "local_only"')],
  ["remote push is explicitly not configured", capabilities.includes('status: "not_configured"') && capabilities.includes('configured: false')],
  ["service worker push receiver is not misrepresented as a provider sender", worker.includes("Receiver only") && capabilities.includes("providerSenderPresent: false")],
  ["legacy smart queue is named as browser alerts, not push delivery", smart.includes("browserAlertQueue") && smart.includes("flushBrowserAlertQueue") && !smart.includes("pushQueue")],
  ["smart notification local display does not require PushManager", !smart.includes('"PushManager" in window')],
  ["smart notifications preserve push-only category preference while preventing duplicate local alerts", smart.includes("pushEnabled: false") && smart.includes("smartNotifications.scheduleNotification(notification)")],
  ["local browser alerts check the browser permission state", smart.includes("Notification.permission === \"granted\"")],
  ["canonical notification system labels browser alerts separately from remote push", notifications.includes("Browser alerts are local UI delivery only") && notifications.includes("remote Web Push requires a server-managed subscription")],
  ["settings explain offline remote push is not configured", settings.includes("Remote push to offline devices is not yet configured")],
  ["worker notification click accepts same-origin navigation only", worker.includes("candidate.origin === self.location.origin") && worker.includes("candidate.protocol === self.location.protocol")],
  ["worker uses generic privacy-safe push display content", worker.includes('const title = "GreenHaven"') && worker.includes('body: "You have a new notification"') && worker.includes('data: { url: "/" }')],
  ["no push subscription registration route is claimed by this phase", !fs.existsSync("app/api/notifications/push-subscription/route.ts")],
  ["no provider sender dependency is claimed by this phase", !Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).some((name) => /web-push/i.test(name))],
]
for (const [name, ok] of checks) { assert.ok(ok, name); console.log(`PASS ${name}`) }
console.log(`Phase 11.2.2 delivery architecture: ${checks.length}/${checks.length} passed`)
