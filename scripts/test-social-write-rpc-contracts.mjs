/**
 * Static regression: four social write flows — RPC names, args, auth, fallbacks, no client service role.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")

const rpc = read("lib/server/social/rpc.ts")
const curation = read("app/api/social/posts/[id]/curation/route.ts")
const comments = read("app/api/social/posts/[id]/comments/route.ts")
const cmtReact = read("app/api/social/posts/[id]/comments/[commentId]/reactions/route.ts")
const saves = read("app/api/social/saves/route.ts")

const checks = []
const row = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail })
  if (!ok) console.error("FAIL", name, detail)
  else console.log("PASS", name)
}

// RPC client
row("service-role only (no browser grant path)", /service_role|supabaseServiceRoleKey/.test(rpc) && !/GRANT EXECUTE.*authenticated/.test(rpc))
row("Content-Profile public on RPC", /Content-Profile["']?\s*:\s*["']public["']/.test(rpc))
row("PGRST202/203 treated as signature miss", /PGRST202/.test(rpc) && /PGRST203/.test(rpc))
row("Phase39 no silent RPC overload fallback", /production no longer probes historical/.test(rpc) || !/RPC_FALLBACKS/.test(rpc))
row("never logs service key", !/console\.(log|warn|error).*serviceRole|SERVICE_ROLE/.test(rpc))

// Curation
row("auth required", /resolveAuthenticatedUser/.test(curation) && /AUTH_REQUIRED/.test(curation))
row("strip client authority", /stripClientAuthority/.test(curation))
row("calls with_reward primary", /gh_post_curation_set_with_reward/.test(curation))
row("sends six named args", /p_post_id/.test(curation) && /p_user_id/.test(curation) && /p_choice/.test(curation) && /p_percentage/.test(curation) && /p_curation_weight/.test(curation) && /p_judgment_mode/.test(curation))
row("self-curation rejected path", /SELF_CURATION_FORBIDDEN/.test(curation))
row("curation surfaces SOCIAL_RPC_UNAVAILABLE on signature miss", /SOCIAL_RPC_UNAVAILABLE/.test(curation))
row("session user as actor not body", /auth\.userId/.test(curation))

// Comments
row("comment auth", /AUTH_REQUIRED/.test(comments))
row("comment p_row argument", /socialRpc\("gh_comment_create",\s*\{\s*p_row:\s*comment\s*\}\)/.test(comments))
row("authorId from session", /authorId:\s*auth\.userId/.test(comments))
row("ignores client authorId", /void body\.authorId/.test(comments))

// Comment reactions
row("reaction four named args", /p_post_id:\s*postId/.test(cmtReact) && /p_comment_id:\s*cId/.test(cmtReact) && /p_user_id:\s*auth\.userId/.test(cmtReact) && /p_emoji:\s*emoji/.test(cmtReact))
row("reaction auth", /AUTH_REQUIRED/.test(cmtReact))
row("comment belongs to post check", /commentBelongsToPost/.test(cmtReact))

// Saves
row("save two named args", /p_user_id:\s*auth\.userId/.test(saves) && /p_post_id:\s*postId/.test(saves))
row("save auth", /AUTH_REQUIRED/.test(saves))
row("save visibility check", /canViewSocialPost/.test(saves))

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
