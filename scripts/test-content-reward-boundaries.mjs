/**
 * Content reward security boundaries — static + unit checks.
 * Votes must not mint GHC; client must not author amounts.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0
let fail = 0

function ok(cond, msg) {
  if (cond) {
    pass++
    console.log("PASS ", msg)
  } else {
    fail++
    console.log("FAIL ", msg)
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

const route = read("app/api/social/posts/[id]/reward/route.ts")
const store = read("lib/server/content-reward/store.ts")
const panel = read("components/ghc/post-reward/post-reward-panel.tsx")
const card = read("components/ghc/enhanced-post-card.tsx")
const mig = read("supabase/migrations/20261022_gh_content_rewards.sql")
const curation = read("app/api/social/posts/[id]/curation/route.ts")

ok(route.includes("getPublicContentReward"), "reward GET uses server store")
ok(!/export async function POST/.test(route), "no POST mutation on reward route")
ok(!route.includes("ghc_execute_"), "reward route does not call ledger spend")
ok(store.includes("inactive"), "store has inactive fail-closed state")
ok(store.includes("gh_content_reward_get_public"), "store reads public RPC")
ok(!store.includes("clientSuggested"), "store does not accept client amounts")
ok(panel.includes("showMoney"), "UI gates money display on server enablement")
ok(panel.includes("do not mint GHC") || panel.includes("do not mint GHC by themselves") || panel.includes("do not mint"), "UI explains no vote-mint")
ok(panel.includes("/api/social/posts/") && panel.includes("/reward"), "panel fetches reward API")
ok(card.includes("PostRewardPanel"), "post card mounts reward panel")
ok(card.includes("ThumbsUp") || card.includes("ThumbsDown"), "modern vote icons")
ok(mig.includes("ENABLE ROW LEVEL SECURITY"), "migration enables RLS")
ok(mig.includes("gh_content_rewards_no_client"), "deny-all client policy")
ok(mig.includes("GRANT EXECUTE") && mig.includes("service_role"), "RPCs service_role only")
ok(mig.includes("REVOKE ALL") && mig.includes("FROM PUBLIC"), "PUBLIC execute revoked")
ok(!mig.includes("ghc_execute_spend"), "migration does not auto-spend ledger")
ok(!curation.includes("ghc_execute_") && !curation.includes("ghc_stage_pending"), "curation path does not stage GHC")
ok(!curation.includes("gh_content_reward_system_upsert"), "votes do not write reward rows")

// Author/curation share constants exist server-side only
const types = read("lib/content-reward/public-types.ts")
ok(types.includes("CONTENT_REWARD_AUTHOR_SHARE"), "author share constant defined")
ok(types.includes("0.7"), "default author share 70%")

console.log(`\n=== CONTENT REWARD BOUNDARIES: ${fail === 0 ? "PASS" : "FAIL"} (${pass}/${pass + fail}) ===`)
process.exit(fail === 0 ? 0 : 1)
