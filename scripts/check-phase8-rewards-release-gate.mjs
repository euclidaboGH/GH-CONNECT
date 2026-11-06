#!/usr/bin/env node
/** Phase 8 Rewards source release gate. External acceptance is tracked separately. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(fileURLToPath(new URL('..', import.meta.url)))
const read = (file) => readFileSync(join(root, file), 'utf8')
const daily = read('app/api/economy/rewards/daily/route.ts')
const claim = read('app/api/economy/rewards/claim/route.ts')
const evaluate = read('app/api/economy/rewards/evaluate/route.ts')
const missions = read('app/api/economy/missions/progress/route.ts')
const missionSql = read('supabase/migrations/20261106170001_phase8_verified_mission_achievements.sql')
const cashback = read('app/api/economy/rewards/pi-cashback/claim/route.ts')
const centre = read('components/ghc/rewards-centre-screen.tsx')
const checks = [
  ['Daily claim requires authenticated server identity', daily.includes('resolveAuthenticatedUser(request.headers)')],
  ['Daily claim uses durable fail-closed rate limiting', daily.includes('checkDurableRateLimit') && daily.includes('onUnavailable: "deny"')],
  ['Daily claim request body is bounded and client amounts are ignored', daily.includes('readBoundedJson(request, 4096)') && daily.includes('void body.amount') && daily.includes('void body.ghc')],
  ['Daily claim issuance requires durable database or explicitly allowed memory mode', daily.includes('ghc_execute_daily_claim_v12') && daily.includes('In-memory claims are disabled on this deployment')],
  ['Pending reward redemption is authenticated and rate limited', claim.includes('resolveAuthenticatedUser(request.headers)') && claim.includes('checkDurableRateLimit')],
  ['Reward redemption derives amount and owner from server hold', claim.includes('rpcClaimPending(auth.userId, holdId)') && claim.includes('Claim amount and user are server-derived')],
  ['Generic activity issuance remains policy locked', evaluate.includes('GHC_ISSUANCE_POLICY_LOCKED') && evaluate.includes('503')],
  ['Missions are verified by a service-role RPC and fail closed when unavailable', missions.includes('socialRpc("gh_rewards_mission_complete"') && missions.includes('MISSION_VERIFICATION_UNAVAILABLE')],
  ['Mission completion never issues GHC or Pi', missions.includes('grantedGhc: 0') && missions.includes('rewardStatus') && !/mintGhc|transferGhc|ledger\.insert|settleReward\s*\(/i.test(missions)],
  ['Pi cashback payout is explicitly Testnet-only and separately authorized', cashback.includes('PI_A2U_TESTNET_ONLY !== "true"') && cashback.includes('assertPayoutWalletAuthorization') && cashback.includes('Pi Testnet')],
  ['Rewards history reads same-user ledger and never mixes Pi cashback into GHC', centre.includes('/api/economy/wallet/${encodeURIComponent(userId)}?limit=200') && centre.includes('Two different rewards')],
  ['Rewards UI does not add client-side financial mutation authority', !/ledger\.insert|mintGhc|transferGhc|settleReward\s*\(/i.test(centre)],
  ['Mission verifier uses a fixed search_path and service-role-only execution', missionSql.includes('SECURITY DEFINER') && missionSql.includes('SET search_path = pg_catalog, public') && missionSql.includes('GRANT EXECUTE ON FUNCTION public.gh_rewards_mission_complete(text, text) TO service_role') && missionSql.includes('REVOKE ALL ON FUNCTION public.gh_rewards_mission_complete(text, text) FROM PUBLIC, anon, authenticated')],
  ['Mission achievements use advisory locking and unique-conflict idempotency', missionSql.includes('pg_advisory_xact_lock') && missionSql.includes('ON CONFLICT (gh_user_id, achievement_id) DO NOTHING')],
  ['Phase 8 release gate is included in both build and static verification', (() => { const p=JSON.parse(read('package.json')); return (p.scripts.prebuild.match(/check-phase8-rewards-release-gate\.mjs/g)||[]).length===1 && (p.scripts['verify:static'].match(/check-phase8-rewards-release-gate\.mjs/g)||[]).length===1 })()],
]
let failed=0
for (const [label,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${label}`); if(!ok) failed++ }
if(failed) process.exit(1)
console.log(`Phase 8 Rewards source release gate: ${checks.length}/${checks.length} passed.`)
