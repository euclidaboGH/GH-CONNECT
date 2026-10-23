import fs from 'node:fs'
import assert from 'node:assert/strict'

const migration = fs.readFileSync('supabase/migrations/20261022120004_gh_social_economy_control_plane.sql','utf8')
const rep = fs.readFileSync('supabase/migrations/20261022120005_gh_reputation_social_events.sql','utf8')
const status = fs.readFileSync('app/api/social/economy/status/route.ts','utf8')
const comments = fs.readFileSync('app/api/social/posts/[id]/comments/route.ts','utf8')
const curation = fs.readFileSync('app/api/social/posts/[id]/curation/route.ts','utf8')
const client = fs.readFileSync('lib/social/client.ts','utf8')
const redistribute = fs.readFileSync('lib/server/curation/redistribute.ts','utf8')

assert.match(migration, /gh_social_economy_snapshot/)
assert.match(migration, /commentsMintGhc.*false/)
assert.match(migration, /curationMovesExistingGhc.*true/)
assert.match(migration, /gh_content_reward_record_funded_settlement/)
assert.match(migration, /CURATION_REDISTRIBUTE_V1/)
assert.match(rep, /comment_created/)
assert.match(comments, /p_event_type: "comment"/)
assert.match(comments, /p_event_type: "comment_created"/)
assert.match(status, /gh_social_economy_snapshot/)
assert.match(curation, /availableBalanceAfter/)
assert.match(curation, /contentRewardRecorded/)
assert.match(client, /socialEconomyStatus/)
assert.match(redistribute, /contentRewardRecorded/)

console.log('PASS phase 15 social economy control-plane contract: 14/14')
