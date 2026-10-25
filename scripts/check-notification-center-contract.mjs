#!/usr/bin/env node
/** Regression contract for global notification access, refresh wiring and accessible status. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const app = readFileSync(join(root, "components/ghc/app.tsx"), "utf8")
const actions = readFileSync(join(root, "components/ghc/premium-surface-actions.tsx"), "utf8")
const bell = readFileSync(join(root, "components/ghc/notification-bell.tsx"), "utf8")
const checks = [
  ["notification center is lazy-loaded inside the shared compact header actions", /const NotificationBell = lazy\([\s\S]*?import\("\.\/notification-bell"\)/.test(actions) && /<NotificationBell\s*\/>/.test(actions)],
  ["gold bell sits inline after Marketplace and Ecosystem, with no top-right overlay", actions.indexOf("Open Marketplace") < actions.indexOf("Open Ecosystem") && actions.indexOf("<NotificationBell />") > actions.indexOf("Open Ecosystem") && !app.includes("Global notification entry point")],
  ["home red dot no longer incorrectly mirrors all local and economy alerts", /id === "home" && socialAttentionCount > 0/.test(app) && !/id === "home" && \(socialAttentionCount \+ localAttentionCount \+ economyAttentionCount/.test(app)],
  ["bell has a keyboard-visible focus indicator and accessible unread label", /focus-visible:ring-2/.test(bell) && /aria-label=\{unread > 0 \? `\$\{unread\} unread notifications` : "Notifications"\}/.test(bell)],
  ["notification permission is not requested as a side effect of opening the inbox", /const openPanel = \(\) => \{\s*setOpen\(true\)\s*refresh\(\)/.test(bell) && !/const openPanel = \(\) => \{[\s\S]{0,180}requestBrowserNotificationPermission/.test(bell)],
  ["notification refresh prevents overlapping async polling requests", /refreshInFlightRef = useRef\(false\)/.test(bell) && /if \(refreshInFlightRef\.current\) return/.test(bell) && /refreshInFlightRef\.current = false/.test(bell)],
  ["read, community, marketplace, wallet and payment events refresh the bell", ["ghc:notifications-read", "ghc:community-updated", "ghc:marketplace-updated", "ghc:wallet-updated", "ghc:payment-updated"].every((event) => bell.includes(`window.addEventListener("${event}"`) && bell.includes(`window.removeEventListener("${event}"`))],
  ["notification center loads separate unified, social, economy and announcement stores", ["/api/notifications?limit=80", "/api/social/notifications?limit=80", "/api/economy/notifications?limit=60", "/api/system/announcements?limit=25"].every((path) => bell.includes(path))],
  ["mark-all-read is wired to unified, social, economy and announcement stores", ["/api/social/notifications", "/api/notifications", "/api/economy/notifications/read-all", "/api/system/announcements"].every((path) => bell.includes(path)) && /body: JSON.stringify\(\{ markAll: true \}\)/.test(bell)],
  ["notification center exposes non-intrusive accessible status updates", /role="status" aria-live="polite"/.test(bell)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Notification center contract: ${checks.length}/${checks.length} checks passed.`)
