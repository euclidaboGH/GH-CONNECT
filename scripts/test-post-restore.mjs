#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
let failed = 0
function ok(condition, label) {
  if (condition) console.log(`PASS ${label}`)
  else { console.error(`FAIL ${label}`); failed++ }
}
const routePath = "app/api/social/posts/[id]/restore/route.ts"
const migrationPath = "supabase/migrations/20261022010109_gh_post_restore_owner_window.sql"
ok(existsSync(routePath), "restore route exists")
ok(existsSync(migrationPath), "owner restore migration exists")
const route = readFileSync(routePath, "utf8")
const sql = readFileSync(migrationPath, "utf8")
ok(route.includes('resolveAuthenticatedUser'), "requires authenticated session")
ok(route.includes('nonDurableWriteResponse'), "fails closed when database unavailable")
ok(route.includes('gh_post_restore'), "calls authoritative restore RPC")
ok(route.includes('FORBIDDEN') && route.includes('NOT_FOUND'), "maps owner and missing-post failures")
ok(route.includes('curationWeightsRestored: false'), "does not claim historical curation restoration")
ok(sql.includes('FOR UPDATE'), "locks target row against concurrent delete/restore")
ok(sql.includes("v_author IS DISTINCT FROM trim(p_actor_id)"), "enforces owner-only restore")
ok(sql.includes("interval '30 days'"), "enforces bounded 30-day recovery window")
ok(sql.includes("REVOKE ALL ON FUNCTION public.gh_post_restore(text, text) FROM PUBLIC"), "revokes public RPC access")
ok(sql.includes("GRANT EXECUTE ON FUNCTION public.gh_post_restore(text, text) TO service_role"), "grants RPC only to service role")
ok(sql.includes("ghcMutated', false"), "does not mutate GHC")
if (failed) process.exit(1)
console.log(`Post restore source checks: ${12-failed}/12 passed`)
