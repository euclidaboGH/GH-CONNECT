#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
let fail = 0
const ok = (l, c) => { if (c) console.log(`PASS ${l}`); else { console.log(`FAIL ${l}`); fail++ } }
const n = fs.readFileSync(path.join(root, "components/ghc/notification-bell.tsx"), "utf8")
ok("focus segment All/Unread/Priority", n.includes('aria-label={t("notificationFocus")}') && n.includes("Priority"))
ok("category chips with unread counts", n.includes("bucketUnreadCounts[b.id]") && n.includes("99+"))
ok("empty unread CTA show all", n.includes('t("showAllNotifications")') && n.includes('setReadFilter("all")'))
ok("priority empty copy", n.includes("Priority covers messages"))
ok("mark all read retained", n.includes("Mark all read") || n.includes("markAll"))
ok("deep link buckets retained", n.includes("NOTIFICATION_CENTER_BUCKETS"))
const f = fs.readFileSync(path.join(root, "components/ghc/enhanced-feed-screen.tsx"), "utf8")
ok("feed filters editorial or pill active state", (f.includes("border-[var(--gh-green)]") || f.includes("bg-emerald-600")) && f.includes('aria-label={t("feedFilters")}'))
ok("feed filter titles with hints", f.includes("title={t(filter.label)}"))
ok("version 0.301.0", JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version === "0.301.0")
console.log(`\nNotifications & filters UX: ${9 - fail}/9 passed`)
process.exit(fail ? 1 : 0)
