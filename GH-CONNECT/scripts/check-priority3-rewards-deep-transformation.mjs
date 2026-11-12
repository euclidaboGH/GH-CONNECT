#!/usr/bin/env node
/** Priority 3 deep Rewards transformation: truthful progress, claim feedback and bounded history paging. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const read = (path) => readFileSync(path, 'utf8')
const screen = read('components/ghc/rewards-centre-screen.tsx')
const walletRoute = read('app/api/economy/wallet/[userId]/route.ts')
const db = read('lib/server/economy/db.ts')
const challengeDomain = read('lib/domains/reward-challenges.ts')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const checks = [
  ['Reward history requests bounded 50-row pages from the authenticated wallet endpoint', screen.includes('new URLSearchParams({ limit: "50" })') && screen.includes('params.set("from", historyFrom)') && screen.includes('params.set("to", historyTo)')],
  ['Older pages append without duplicating already loaded ledger transaction IDs', screen.includes('previous.map((row) => row.id)') && screen.includes('!seen.has(row.id)')],
  ['Previously loaded server history stays visible while older pages load or a later page fails', screen.includes('serverRewardTransactions !== null ?') && screen.includes('previously loaded server entr')],
  ['History exposes a real load-older action only when the server reports another page', screen.includes('serverHistoryHasMore && serverRewardTransactions !== null') && screen.includes('Load older ledger entries')],
  ['Account changes clear previous history and trigger a fresh hydration for the new owner', screen.includes('serverHistoryOwnerRef.current !== userId') && screen.includes('setServerRewardTransactions(null)') && screen.includes('setTick((value) => value + 1)')],
  ['Wallet history API validates an account-bound cursor and bounds page size', walletRoute.includes('decodeHistoryCursor(url.searchParams.get("cursor"), userId)') && walletRoute.includes('Math.min(Math.max(Number.isFinite(limitParam)') && walletRoute.includes('transactions.slice(0, limitTx)')],
  ['History API reports stable keyset continuation with exact timestamp and UUID validation', walletRoute.includes('nextCursor') && walletRoute.includes('hasMore: hasMore && Boolean(nextCursor)') && walletRoute.includes('ordering: "created_at_desc_id_desc"') && walletRoute.includes('HISTORY_CURSOR_UUID') && walletRoute.includes('HISTORY_CURSOR_TIMESTAMP') && walletRoute.includes('parsed.userId !== userId')],
  ['Exact database timestamp cursor is server-internal and not copied into client transaction rows', walletRoute.includes('createdAtCursor: _cursorTimestamp') && walletRoute.includes('createdAt: lastRow.createdAtCursor')],
  ['Server transaction source remains owner-filtered and uses deterministic timestamp-plus-ID ordering', db.includes('user_id: `eq.${userId}`') && db.includes('order: "created_at.desc,id.desc"') && db.includes('params.set("or"') && db.includes('createdAtCursor: r.created_at == null ? undefined : String(r.created_at)') && walletRoute.includes('Do not re-sort them by millisecond timestamps')],
  ['Database-backed wallet balance remains a complete canonical snapshot, never a paged-history calculation', walletRoute.includes('rpcWalletSnapshot(userId)') && walletRoute.includes('Failed to load authoritative wallet snapshot')],
  ['Claim success wording does not claim the balance was credited before ledger refresh', screen.includes('Claim accepted ✓ · wallet ledger refresh requested') && !screen.includes('Claimed ✓ · added to available balance')],
  ['Claim CTA reports server acceptance rather than claiming immediate available-balance posting', screen.includes('✓ Claim accepted')],
  ['Claim-ready summary explicitly identifies its count as locally marked and server-gated', screen.includes('Locally marked claim-ready') && screen.includes('A server check must still accept the claim')],
  ['Mission progress is explicitly guidance and not durable server proof', screen.includes('not proof of durable completion') && screen.includes('Only a successful server verification creates a durable achievement record')],
  ['Supported mission cards become completed only from the durable server achievement list', screen.includes('const durableMissionIds = new Set(achievements.map((row) => row.id))') && screen.includes('durableMissionIds.has(missionCode)') && screen.includes('status: "pending_validation" as const') && screen.includes('completed: "Achievement unlocked"') && screen.includes('Server verified') && screen.includes('Verify achievement')],
  ['Missions without a supported durable verifier are locked instead of presenting an unfinishable action', screen.includes('if (!missionCode)') && screen.includes('status: "locked" as const') && screen.includes('durable server verification workflow is not available')],
  ['All seven durable server-supported mission codes have explicit Rewards cards and eligibility checks', ['complete_profile','join_community','meaningful_contribution','first_post','first_comment','send_connection','accept_connection'].every((code) => screen.includes(`\"${code}\"`)) && screen.includes('Check eligibility') && screen.includes('non-financial achievement is saved automatically')],
  ['Unsupported marketplace, community-event and referral missions remain gated until server evidence exists', challengeDomain.includes('challenge_marketplace_sale') && challengeDomain.includes('challenge_community_activity') && challengeDomain.includes('challenge_genuine_invite') && screen.includes('durable server verification workflow is not available')],
  ['Current mission challenge definitions do not advertise GHC amounts', (challengeDomain.match(/rewardAmount:\s*\d+/g) || []).every((value) => value.trim().endsWith('0'))],
  ['Mission completion remains non-financial under current policy', screen.includes('Mission completion does not issue GHC under the current economy policy')],
  ['GHC and Pi cashback remain distinct reward journeys', screen.includes('Two different rewards') && screen.includes('<PiCashbackSummary />')],
  ['No client-side ledger minting or settlement authority is added to Rewards UI', !/ledger\.insert|mintGhc|transferGhc|settleReward\s*\(/i.test(screen)],
  ['Deep Rewards regression check is registered exactly once in both build gates', (pkg.scripts['prebuild:checks'].match(/check-priority3-rewards-deep-transformation\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-priority3-rewards-deep-transformation\.mjs/g) || []).length === 1],
  ['Release version is aligned across package, lockfile and in-app metadata', Boolean(pkg.version) && lock.version === pkg.version && lock.packages[''].version === pkg.version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = \"${pkg.version}\"`)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
assert.equal(failed, 0, `${failed} deep Rewards checks failed`)
console.log(`Priority 3 deep Rewards transformation: ${checks.length}/${checks.length} passed`)
