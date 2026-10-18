import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0
let failed = 0
const assert = (condition, message) => {
  if (condition) {
    passed += 1
    console.log("  ✓", message)
  } else {
    failed += 1
    console.error("  ✗", message)
  }
}

console.log("\n=== ENGAGEMENT ROSTER SECURITY REGRESSION CHECK ===\n")
const migrationPath = "supabase/migrations/202610240003_gh_post_reaction_roster_visibility_guard.sql"
assert(existsSync(join(root, migrationPath)), "forward migration exists for already-migrated databases")
const migration = readFileSync(join(root, migrationPath), "utf8")
assert(migration.includes("p_actor_id text") && migration.includes("v_actor = ''"), "rejects missing actor identity")
assert(migration.includes("public.ghc_user_blocks") && migration.includes("b.blocker_id = v_actor"), "respects either-direction blocks")
assert(migration.includes("v_visibility = 'public' OR v_author = v_actor"), "allows public posts and the owner")
assert(migration.includes("v_visibility = 'followers'") && migration.includes("f.follower_id = v_actor"), "requires a follow edge for follower-only posts")
assert(migration.includes("RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN')"), "denies roster access when post visibility is not satisfied")
assert(migration.includes("REVOKE ALL ON FUNCTION public.gh_list_post_reactions") && migration.includes("TO service_role"), "limits direct RPC execution to service role")

const routePath = "app/api/social/posts/[id]/reactions/list/route.ts"
const route = readFileSync(join(root, routePath), "utf8")
assert(route.includes("resolveAuthenticatedUser(request.headers)"), "HTTP route requires an authenticated user")
assert(route.includes("p_actor_id: auth.userId"), "server-derived identity is passed to the RPC")
assert(route.includes("code === \"FORBIDDEN\" ? 403"), "forbidden responses are not reported as successful lists")

console.log(`\nPassed: ${passed}; Failed: ${failed}\n`)
if (failed) process.exit(1)
console.log("ENGAGEMENT ROSTER SECURITY CHECKS PASSED\n")
