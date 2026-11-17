import fs from "node:fs"
import assert from "node:assert/strict"
const route = fs.readFileSync("app/api/social/posts/[id]/reactions/route.ts", "utf8")
const migration = fs.readFileSync("supabase/migrations/20261023040003_gh_feed_engagement_batch_v2.sql", "utf8")
const checks = [
  ["reaction summary uses canonical batch aggregate RPC", /socialRpc\("gh_post_feed_engagement_batch"/.test(route)],
  ["aggregate request is scoped to the authenticated actor and one post", /p_post_ids: \[postId\][\s\S]*p_viewer_id: auth\.userId/.test(route)],
  ["fixed PostgREST reaction-row cap is removed", !/gh_post_reactions\?/.test(route) && !/limit: \"5000\"/.test(route)],
  ["aggregate response is matched to the requested post", /rows\.find\([\s\S]*postId/.test(route)],
  ["reaction counts are accepted only as non-negative safe integers", /Number\.isSafeInteger\(numeric\) && numeric >= 0/.test(route)],
  ["viewer reaction state is derived from the aggregate response", /viewerReactions[\s\S]*post\.viewerReactions/.test(route)],
  ["batch RPC aggregates every reaction row for requested post IDs", /FROM public\.gh_post_reactions pr[\s\S]*WHERE pr\.post_id = ANY\(v_ids\)[\s\S]*GROUP BY pr\.post_id, pr\.reaction/.test(migration)],
  ["batch RPC is service-role only", /REVOKE ALL ON FUNCTION public\.gh_post_feed_engagement_batch\(text\[\], text\) FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_post_feed_engagement_batch\(text\[\], text\) TO service_role/.test(migration)],
]
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); assert.ok(ok, label) }
console.log(`Phase 2 reaction aggregate bounds: ${checks.length}/${checks.length} PASS`)
