import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
let failures = 0
function check(ok, message) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`)
  if (!ok) failures++
}

const card = read('components/ghc/enhanced-post-card.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const daily = read('app/api/economy/rewards/daily/route.ts')
const redeem = read('app/api/economy/rewards/claim/route.ts')
const transfer = read('app/api/economy/transfers/route.ts')
const plan = read('GH_CONNECT_10_PHASE_GLOBAL_BETA_PROGRAMME.md')

check(card.includes('onMouseDown={() => handleLongPress("positive")}'), 'mouse long-press passes reaction kind explicitly')
check(card.includes('onTouchStart={() => handleLongPress("positive")}'), 'touch long-press passes reaction kind explicitly')
check(!/onMouseDown=\{handleLongPress\}/.test(card), 'React mouse event is not passed as reaction kind')
check(feed.includes('}, [currentUserId, dailyClaim.status?.claimable, dailyClaim.status?.dayKey])'), 'reward notice effect dependencies match the exact status fields used')
check(daily.includes('rpcExecuteDailyClaimV12'), 'daily claim uses authoritative atomic RPC path')
check(redeem.includes('rpcClaimPending'), 'redemption uses server RPC path')
check(transfer.includes('rpcExecuteTransfer'), 'transfer uses authoritative atomic RPC path')
check(plan.includes('48 hours') && plan.includes('only issuance source'), 'programme records 48-hour and sole-issuance invariants')

console.log(`\n${failures ? 'FAILED' : 'PASSED'}: ${8 - failures}/8 baseline checks`)
process.exitCode = failures ? 1 : 0
