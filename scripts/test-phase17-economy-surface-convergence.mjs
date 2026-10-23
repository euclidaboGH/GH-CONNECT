import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const checks = []
function check(name, ok, detail='') {
  checks.push({name, ok, detail})
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
}

const rewardPanel = read('components/ghc/post-reward/post-reward-panel.tsx')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const economyStatus = read('app/api/social/economy/status/route.ts')
const postGet = read('app/api/social/posts/[id]/route.ts')
const rewardStore = read('lib/server/content-reward/store.ts')

check('post reward hydrates on mount', /useEffect\(\(\) => \{[\s\S]*?setLoading\(true\)[\s\S]*?\/api\/social\/posts\/.+\/reward/.test(rewardPanel))
check('post reward is not gated behind opening the panel', !/if \(!open\) return/.test(rewardPanel))
check('post reward refresh event remains wired', rewardPanel.includes('ghc:content-reward-updated'))
check('reward amounts remain server-derived', rewardPanel.includes('/api/social/posts/${encodeURIComponent(postId)}/reward'))
check('rewards centre reads authoritative social economy endpoint', rewards.includes('/api/social/economy/status'))
check('rewards centre exposes available balance', rewards.includes('Available'))
check('rewards centre exposes pending balance', rewards.includes('Pending'))
check('rewards centre exposes locked balance', rewards.includes('Locked'))
check('rewards centre exposes curation funding state', rewards.includes('canFundSuggestedContribution'))
check('wallet refreshes authoritative economy service', wallet.includes('await eco?.refresh?.()'))
check('wallet consumes social economy status', wallet.includes('socialEconomyStatus()'))
check('economy status requires authenticated user', economyStatus.includes('resolveAuthenticatedUser'))
check('economy status uses server snapshot RPC', economyStatus.includes('gh_social_economy_snapshot'))
check('post GET hydrates content reward', postGet.includes('getPublicContentReward') && postGet.includes('contentReward'))
check('content reward read path fails closed', rewardStore.includes('inactivePublic') && rewardStore.includes('feature') || rewardStore.includes('fail-closed inactive'))

console.log(`PASS phase 17 economy-surface convergence: ${checks.length}/${checks.length}`)
