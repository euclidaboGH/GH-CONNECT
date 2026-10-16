/**
 * Static notification system tests — wiring, security, economic isolation.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0
let fail = 0

function ok(name, cond, detail = "") {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`)
  }
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

console.log("Social notifications\n")

const mig = read("supabase/migrations/20261003_gh_social_notifications.sql")
const mig2 = read("supabase/migrations/20261021_gh_social_notifications_types_extend.sql")
const api = read("app/api/social/notifications/route.ts")
const server = read("lib/server/social/notifications.ts")
const reactions = read("app/api/social/posts/[id]/reactions/route.ts")
const comments = read("app/api/social/posts/[id]/comments/route.ts")
const follows = read("app/api/social/follows/route.ts")
const curation = read("app/api/social/posts/[id]/curation/route.ts")
const reputation = read("app/api/social/reputation/route.ts")
const bell = read("components/ghc/notification-bell.tsx")

ok("table RLS deny-all clients", /gh_social_notifications_no_client/.test(mig) && /USING \(false\)/.test(mig))
ok("unique dedupe index", /uq_gh_social_notifications_dedupe/.test(mig))
ok("create RPC service_role only", /GRANT EXECUTE ON FUNCTION public.gh_social_notification_create/.test(mig))
ok("create rejects client path in API", /Clients cannot create social notifications/.test(api))
ok("API uses session recipient only", /resolveAuthenticatedUser/.test(api) && /auth\.userId/.test(api))
ok("API rate-limits mark-read", /checkRateLimit\(`notifications:/.test(api))
ok("mark-read fails closed on DB error", /MARK_READ_FAILED|DB_UNAVAILABLE/.test(api))
ok("self-skip in create SQL", /reason', 'SELF'/.test(mig) || /reason', 'SELF'/.test(mig2))
ok("extended types reputation_level_up", /reputation_level_up/.test(mig2))
ok("extended types system", /'system'/.test(mig2))
ok("reactions emit after success", /emitSocialNotification/.test(reactions) && /post_like/.test(reactions))
ok("comments emit", /post_comment|comment_reply/.test(comments) && /emitSocialNotification/.test(comments))
ok("follows emit", /emitSocialNotification/.test(follows) && /follow/.test(follows))
ok("curation emit safe wording", /Community review/.test(curation) && /emitSocialNotification/.test(curation))
ok("curation does not expose JCS in notification body", !/JCS|integrity|curationPower/.test(
  curation.split("Community review")[1]?.slice(0, 400) || ""
))
ok("reputation level-up emit", /reputation_level_up/.test(reputation) && /result\.level > prevLevel/.test(reputation))
ok("server types include level-up", /reputation_level_up/.test(server))
ok("no ghc_execute in notification server", !/ghc_execute_/.test(server))
ok("no ghc_execute in notification API", !/ghc_execute_/.test(api))
ok("bell fetches durable API", /\/api\/social\/notifications/.test(bell))
ok("bell marks read via API", /mark_read|markAll/.test(bell))
ok("dedupe key used on reaction path", /dedupeKey/.test(reactions))
ok("migration has no economy mutation columns", !/ghc_amount|balance_delta|mint_amount/.test(mig))
ok("comment states informational only", /No GHC|informational only|No economy/i.test(mig))

console.log(`\nSocial notifications: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
