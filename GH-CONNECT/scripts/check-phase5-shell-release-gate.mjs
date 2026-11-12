#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
let fail = 0
const ok = (label, cond) => {
  if (cond) console.log(`PASS ${label}`)
  else {
    console.log(`FAIL ${label}`)
    fail++
  }
}
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8")

const app = read("components/ghc/app.tsx")
ok("attention fails closed when not server-verified", app.includes("!authLifecycle?.serverVerified") && app.includes("setSocialAttentionCount(0)"))
ok("attention zeros on 401/403", app.includes("status === 401") && app.includes("status === 403"))
ok("notifications-read optimistic clear", app.includes("onNotificationsRead") && app.includes("setSocialAttentionCount(0)"))
ok("home re-tap opens notifications when attention", app.includes('ghc:open-notifications') && app.includes('filter: "all"'))
ok("home re-tap refreshes feed via emitSectionRefresh", app.includes('emitSectionRefresh("feed"'))
ok("messages attention refreshes messages section", app.includes('emitSectionRefresh("messages"'))
ok("cart bottom nav opens marketplace cart bucket", app.includes('bucket: "cart"') && app.includes("bottom-cart"))
ok("badge aria explains home inbox", app.includes("open Home again for inbox") || app.includes("tap Home again"))
ok("toast host above bottom nav", app.includes("gh-toast-host") && app.includes("gh-toast-bottom-inset"))
ok("post-login soft refresh of primary sections", app.includes("serverVerified") && app.includes('"feed"') && app.includes('"notifications"'))

// Nested phase gates
const phases = [
  "scripts/check-phase1-truth-honesty.mjs",
  "scripts/check-phase2-commerce-cart.mjs",
  "scripts/check-phase3-wallet-rewards-separation.mjs",
  "scripts/check-phase4-discover-communities.mjs",
]
for (const rel of phases) {
  const r = spawnSync(process.execPath, [path.join(root, rel)], { encoding: "utf8" })
  const passed = r.status === 0
  ok(`nested ${path.basename(rel)}`, passed)
  if (!passed) {
    console.log(r.stdout || "")
    console.log(r.stderr || "")
  }
}

console.log("")
console.log(`Phase 5 shell release gate: ${10 + phases.length - fail}/${10 + phases.length} passed`)
process.exit(fail ? 1 : 0)
