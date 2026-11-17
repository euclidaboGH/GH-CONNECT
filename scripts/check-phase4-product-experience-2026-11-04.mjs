#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
let pass = 0, fail = 0
function ok(n, c, d="") {
  if (c) { pass++; console.log("PASS", n) }
  else { fail++; console.log("FAIL", n, d) }
}
const auth = join(root, "lib/domains/adapters/community-ui-authority.ts")
const comm = join(root, "components/ghc/communities-screen.tsx")
const disc = join(root, "components/ghc/discovery-grid-screen.tsx")
const msg = join(root, "components/ghc/message-screen.tsx")
const notif = join(root, "components/ghc/notification-bell.tsx")
const feed = join(root, "components/ghc/enhanced-feed-screen.tsx")
const doc = join(root, "docs/PHASE-4-PRODUCT-EXPERIENCE-2026-11-04.md")

const a = existsSync(auth) ? readFileSync(auth, "utf8") : ""
ok("community authority uses identity-match", a.includes("identity-match") && a.includes("idListIncludes"))
ok("community createdBy isSameIdentity", a.includes("isSameIdentity(row.createdBy)"))

const c = existsSync(comm) ? readFileSync(comm, "utf8") : ""
ok("communities seed uses aliases", c.includes("idListIncludes(c.members") || c.includes("idListIncludes(c.members"))
ok("hub joined uses isSameIdentity", c.includes("isSameIdentity(selected.createdBy)"))

const d = existsSync(disc) ? readFileSync(disc, "utf8") : ""
ok("discovery follow rollback", d.includes("roll back optimistic") || d.includes("next.delete(id)"))

const m = existsSync(msg) ? readFileSync(msg, "utf8") : ""
ok("messaging enriches from following", m.includes("ghc.following"))

const n = existsSync(notif) ? readFileSync(notif, "utf8") : ""
ok("notification priority includes payout/connection", n.includes("withdrawal") && n.includes("connection_request"))

const f = existsSync(feed) ? readFileSync(feed, "utf8") : ""
ok("feed visibility soft refresh", f.includes("visibilitychange") && f.includes("section-refresh"))

ok("phase 4 doc", existsSync(doc))
console.log(`\nPhase 4 product experience: ${pass}/${pass+fail} passed`)
process.exit(fail ? 1 : 0)
