#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
let pass = 0, fail = 0
function ok(n, c, d="") {
  if (c) { pass++; console.log("PASS", n) }
  else { fail++; console.log("FAIL", n, d) }
}

const disc = readFileSync(join(root, "components/ghc/discovery-components.tsx"), "utf8")
ok("no invented last-seen random", !disc.includes("Math.random()"))
ok("presence not shared copy", disc.includes("Presence not shared") || disc.includes("Presence offline"))

const grid = readFileSync(join(root, "components/ghc/discovery-grid-screen.tsx"), "utf8")
ok("idListIncludes following", grid.includes("idListIncludes"))
ok("follow-changed event", grid.includes("ghc:follow-changed"))
ok("online only label", grid.includes("Online only"))

const card = readFileSync(join(root, "components/ghc/connection-card.tsx"), "utf8")
ok("primary CTA hierarchy", card.includes("isPrimary") && card.includes("isQuiet"))

const clarity = readFileSync(join(root, "lib/discovery/match-clarity.ts"), "utf8")
ok("Interest label", clarity.includes('likeLabel: "Interest"'))

const hero = readFileSync(join(root, "components/ghc/profile-hero.tsx"), "utf8")
ok("handle lower-case", hero.includes(".toLowerCase()"))

const notif = readFileSync(join(root, "components/ghc/notification-bell.tsx"), "utf8")
ok("default priority focus", notif.includes('return "priority"') && notif.includes("ghc.notif.focus"))

const user = readFileSync(join(root, "components/ghc/user-card.tsx"), "utf8")
ok("UserCard Follow primary", user.includes("{isFollowing ? \"Following\" : \"Follow\"}"))

ok("phase 2 doc", existsSync(join(root, "docs/PHASE-2-SOCIAL-POLISH-DISCOVER-2026-11-04.md")))

console.log(`\nPhase 2 social polish: ${pass}/${pass+fail} passed`)
process.exit(fail ? 1 : 0)
