import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const route = readFileSync(resolve(root, "app/api/social/curation-preferences/route.ts"), "utf8")
const migration = readFileSync(resolve(root, "supabase/migrations/20261023_gh_post_curation_feedback.sql"), "utf8")
const feed = readFileSync(resolve(root, "components/ghc/enhanced-feed-screen.tsx"), "utf8")
const card = readFileSync(resolve(root, "components/ghc/enhanced-post-card.tsx"), "utf8")
const feedRoute = readFileSync(resolve(root, "app/api/social/feed/route.ts"), "utf8")
const settings = readFileSync(resolve(root, "components/ghc/settings.tsx"), "utf8")

const checks = [
  ["authenticated actor derived server-side", route.includes("resolveAuthenticatedUser(request.headers)") && route.includes("p_user_id: auth.userId")],
  ["rate limit on writes", route.includes("checkRateLimit(`curation-preferences:${auth.userId}`")],
  ["bounded feedback allow-list", route.includes('new Set(["show_less", "show_more", "hide"])')],
  ["database outage fails closed", route.includes('error: "PREFERENCES_UNAVAILABLE"') && route.includes("status: 503")],
  ["durable user/post uniqueness", migration.includes("PRIMARY KEY (user_id, post_id)")],
  ["client roles denied table access", migration.includes("CREATE POLICY gh_post_curation_feedback_no_client") && migration.includes("USING (false) WITH CHECK (false)")],
  ["RPC execution limited to service role", migration.includes("TO service_role") && migration.includes("FROM PUBLIC, anon, authenticated")],
  ["blocks and own-post checks", migration.includes("OWN_POST") && migration.includes("BLOCKED")],
  ["preference is not a reward/vote", migration.toLowerCase().includes("does not mutate curation votes, ranking rewards, or wallet balances")],
  ["feed only updates local hidden state after success", feed.indexOf("if (!response.ok || data.ok !== true)") < feed.indexOf("setNotInterestedIds((prev) => prev.includes(id)")],
  ["honest exact-post wording", card.includes("Hide this post")],
  ["feed applies durable preferences server-side", feedRoute.includes("gh_post_curation_feedback_list") && feedRoute.includes('feedbackByPost.get(id) !== "hide"')],
  ["show-more/show-less preferences reorder only eligible posts", feedRoute.includes('feedback === "show_more"') && feedRoute.includes('feedback === "show_less"')],
  ["ranking preferences remain downstream of hard feed filters", feedRoute.indexOf("gh_post_list_feed") < feedRoute.indexOf("gh_post_curation_feedback_list")],
  ["user can reset preferences through authenticated, rate-limited API", route.includes("export async function DELETE") && route.includes("gh_post_curation_feedback_reset") && route.includes("curation-preferences-reset")],
  ["reset RPC is service-role-only", migration.includes("gh_post_curation_feedback_reset(text)") && migration.includes("GRANT EXECUTE ON FUNCTION public.gh_post_curation_feedback_reset(text) TO service_role")],
  ["versioned durable domain event outbox exists", migration.includes("gh_domain_event_outbox") && migration.includes("schema_version integer")],
  ["curation state and domain event are written transactionally", migration.includes("curation.feedback_recorded") && migration.includes("ON CONFLICT (idempotency_key) DO NOTHING")],
  ["outbox table denies direct client access", migration.includes("gh_domain_event_outbox_no_client") && migration.includes("GRANT SELECT, INSERT, UPDATE ON TABLE public.gh_domain_event_outbox TO service_role")],
  ["reset controls do not affect votes or rewards", settings.includes("does not delete your posts, quality votes, rewards, or account data")],
]

let failures = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`)
  if (!ok) failures++
}
console.log(`\n${checks.length - failures}/${checks.length} curation preference static checks passed`)
if (failures) process.exit(1)
