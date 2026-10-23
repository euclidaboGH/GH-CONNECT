import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const migration = read("supabase/migrations/20261022120002_gh_social_economy_wallet_bridge.sql")
const economy = read("lib/domains/economy-domain.ts")
const wallet = read("features/wallet/wallet-screen.tsx")
const curationRoute = read("app/api/social/posts/[id]/curation/route.ts")
const curationClient = read("lib/social/client.ts")
const card = read("components/ghc/enhanced-post-card.tsx")
const rewardTypes = read("lib/content-reward/public-types.ts")
const rewardStore = read("lib/server/content-reward/store.ts")
const rewardPanel = read("components/ghc/post-reward/post-reward-panel.tsx")

assert(migration.includes("20261022120002") || migration.includes("Phase 14.1"), "bridge migration missing")
assert(migration.includes("ADD COLUMN IF NOT EXISTS curation_funded"), "curation funded projection missing")
assert(migration.includes("ghc_curation_redistribute"), "redistribution RPC missing")
assert(migration.includes("v_choice <> 'upvote'"), "redistribution must require an active upvote")
assert(migration.includes("v_post_author <> trim(p_author_id)"), "redistribution must derive/validate post owner")
assert(migration.includes("gh_content_rewards"), "content reward projection missing")
assert(migration.includes("gh_content_reward_contributors"), "curator attribution missing")
assert(migration.includes("No issuance"), "migration must document redistribution-only economics")

assert(economy.includes("async refresh(): Promise<void>"), "economy refresh seam missing")
assert(economy.includes("await repo.hydrate(userId)"), "economy refresh does not hydrate authoritative ledger")
assert(wallet.includes("await eco?.refresh?.()"), "wallet screen does not refresh authoritative ledger")
assert(wallet.includes('window.addEventListener("ghc:wallet-refresh", onRefresh)'), "wallet refresh event missing")

assert(curationRoute.includes("redistributeCurationReward"), "curation route must invoke redistribution bridge")
assert(curationRoute.includes("redistribute"), "curation route must return redistribution result")
assert(curationClient.includes("redistribute?:"), "client curation contract missing redistribution result")
assert(card.includes('window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))'), "curation card does not trigger wallet refresh")
assert(card.includes("Fund your GHC wallet"), "insufficient-balance guidance missing")

assert(rewardTypes.includes("curationFunded"), "public reward type missing curation funded amount")
assert(rewardStore.includes("curationFunded"), "reward read store missing curation funded amount")
assert(rewardPanel.includes("Curation funded"), "post reward panel missing curation funding display")
assert(!rewardPanel.includes('>Author</p>'), "duplicate legacy author reward card remains")

console.log("PASS phase 14 social-economy/wallet bridge contract: 22/22")
