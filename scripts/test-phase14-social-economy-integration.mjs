import fs from 'node:fs'
import assert from 'node:assert/strict'

const migration = fs.readFileSync('supabase/migrations/20261022120003_gh_social_economy_settlement_projection.sql','utf8')
const curation = fs.readFileSync('app/api/social/posts/[id]/curation/route.ts','utf8')
const rewardPanel = fs.readFileSync('components/ghc/post-reward/post-reward-panel.tsx','utf8')
const card = fs.readFileSync('components/ghc/enhanced-post-card.tsx','utf8')
const wallet = fs.readFileSync('features/wallet/wallet-screen.tsx','utf8')

assert.match(migration, /gh_content_reward_record_funded_settlement/)
assert.match(migration, /v_source NOT IN \('curation', 'tip', 'creator_reward'\)/)
assert.match(migration, /tip_ghc_/)
assert.match(migration, /creator_reward_/)
assert.match(migration, /ghc_transactions/)
assert.match(migration, /Never mints GHC|never mints GHC/i)
assert.match(rewardPanel, /ghc:content-reward-updated/)
assert.match(rewardPanel, /api\/social\/posts\/.*\/reward/)
assert.match(card, /ghc:wallet-refresh/)
assert.match(card, /ghc:content-reward-updated/)
assert.match(wallet, /ghc:wallet-refresh/)
assert.match(wallet, /api\/economy\/policy/)

console.log('PASS phase 14 social/economy integration contract: 11/11')
