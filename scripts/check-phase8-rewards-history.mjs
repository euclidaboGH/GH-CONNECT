#!/usr/bin/env node
/** Phase 8 Rewards: authenticated ledger history, account isolation and filtering. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(fileURLToPath(new URL('..', import.meta.url)))
const centre = readFileSync(join(root, 'components/ghc/rewards-centre-screen.tsx'), 'utf8')
const route = readFileSync(join(root, 'app/api/economy/wallet/[userId]/route.ts'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
const release = readFileSync(join(root, 'lib/app-release.ts'), 'utf8')
const roadmap = readFileSync(join(root, 'docs/PRODUCT-ROADMAP.md'), 'utf8')
const checks = [
  ['History uses authenticated same-user GHC wallet endpoint', centre.includes('/api/economy/wallet/${encodeURIComponent(userId)}?limit=200') && route.includes('requireSameUser(auth, userId)')],
  ['Ledger request is no-store and credentialed', centre.includes('credentials: "include"') && centre.includes('cache: "no-store"')],
  ['Ledger request has eight-second timeout and cancellation', centre.includes('window.setTimeout(() => controller.abort(), 8_000)') && centre.includes('signal: controller.signal') && centre.includes('controller.abort()')],
  ['Previous account ledger data is cleared before hydration', centre.includes('setServerRewardTransactions(null)')],
  ['Only GHC earned transactions are included', centre.includes('raw.kind !== "earned"')],
  ['Rows require positive finite amount and valid timestamp', centre.includes('!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(createdAt)')],
  ['Transaction identity is checked against active account', centre.includes('rowUserId !== userId')],
  ['Transaction status is allow-listed', centre.includes('["pending", "posted", "reversed", "expired", "failed"]')],
  ['History is newest-first', centre.includes('.sort((a, b) => b.createdAt - a.createdAt)')],
  ['History provides text search and status filters', centre.includes('historyQuery') && centre.includes('historyStatus') && centre.includes('aria-pressed={historyStatus === value}')],
  ['Server ledger and local supplemental history are distinguished', centre.includes('Server ledger entries are authoritative') && centre.includes('supplemental activity')],
  ['Prior account achievement data is cleared on identity change', centre.includes('setServerAchievements([])')],
  ['Only durable server achievements are presented as unlocked', centre.includes('r.durable === true') && centre.includes('const achievements = serverAchievements.filter') && !centre.includes('services?.achievements?.getUnlockedForProfile?.()')],
  ['Mission progress uses authenticated server verification and fails closed when the verifier is unavailable', readFileSync(join(root, 'app/api/economy/missions/progress/route.ts'), 'utf8').includes('socialRpc("gh_rewards_mission_complete"') && readFileSync(join(root, 'app/api/economy/missions/progress/route.ts'), 'utf8').includes('MISSION_VERIFICATION_UNAVAILABLE')],
  ['No client-side mint/credit/settlement authority added', !/ledger\.insert|mintGhc|transferGhc|settleReward\s*\(/i.test(centre)],
  ['GHC and Pi cashback surfaces remain distinct', centre.includes('PiCashbackSummary') && centre.includes('Two different rewards')],
  ['Release metadata and lockfile synchronized', Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['History contract registered once in prebuild and static verification', (pkg.scripts.prebuild.match(/check-phase8-rewards-history\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-phase8-rewards-history\.mjs/g) || []).length === 1],
  ['Rewards source release gate registered once in prebuild and static verification', (pkg.scripts.prebuild.match(/check-phase8-rewards-release-gate\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-phase8-rewards-release-gate\.mjs/g) || []).length === 1],
  ['Roadmap records Phase 8 source closure and gated external acceptance', roadmap.includes('0.323.0') && roadmap.includes('mission')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Phase 8 Rewards history contract: ${checks.length}/${checks.length} checks passed.`)
