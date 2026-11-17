#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
let pass = 0, fail = 0
function ok(n, c, d="") {
  if (c) { pass++; console.log("PASS", n) }
  else { fail++; console.log("FAIL", n, d) }
}

const mig = "supabase/migrations/20261104180001_gh_community_list_memberships_viewer.sql"
ok("memberships migration exists", existsSync(join(root, mig)))
const sql = existsSync(join(root, mig)) ? readFileSync(join(root, mig), "utf8") : ""
ok("RPC gh_community_list_memberships", sql.includes("gh_community_list_memberships"))
ok("service_role grant", sql.includes("GRANT EXECUTE") && sql.includes("service_role"))
ok("revokes anon/authenticated", sql.includes("REVOKE ALL") && sql.includes("authenticated"))

const api = readFileSync(join(root, "app/api/communities/route.ts"), "utf8")
ok("API merges memberships", api.includes("gh_community_list_memberships") && api.includes("viewerIsMember"))

const screen = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
ok("maps viewerIsMember", screen.includes("viewerIsMember"))
ok("session joined ids", screen.includes("ghc.community.joinedIds.session"))
ok("default My tab", screen.includes('useState<DirectoryTab>("my")'))
ok("discover-only filters", screen.includes('directory === "discover"'))
ok("overscroll shell", screen.includes("overscroll-y-contain"))

const card = readFileSync(join(root, "components/ghc/group-card.tsx"), "utf8")
ok("member singular grammar", card.includes('memberCount === 1 ? "member"'))

ok("phase 3 doc", existsSync(join(root, "docs/PHASE-3-COMMUNITIES-MEMBERSHIP-SHELL-2026-11-04.md")))

const n = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).length
ok("migration count on disk >= 178", n >= 178, `count=${n}`)

console.log(`\nPhase 3 communities membership: ${pass}/${pass+fail} passed`)
process.exit(fail ? 1 : 0)
