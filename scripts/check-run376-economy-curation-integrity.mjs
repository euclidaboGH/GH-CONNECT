#!/usr/bin/env node
/** RUN376: source contracts for economy, curation, and withdrawal safety improvements. */
import { readFileSync, existsSync } from 'node:fs'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const settlement = read('lib/server/ghpv/settlement.ts')
const settleService = read('lib/server/ghpv/settle-service.ts')
const settleRoute = read('app/api/social/posts/[id]/ghpv/settle/route.ts')
const redistribution = read('lib/server/curation/redistribute.ts')
const population = read('lib/server/economy/population.ts')
const claim = read('lib/server/economy/claim-engine.ts')
const activity = read('lib/server/economy/activity-emission.ts')
const durable = read('lib/server/economy/durable-emission.ts')
const economyDb = read('lib/server/economy/db.ts')
const dailyRoute = read('app/api/economy/rewards/daily/route.ts')
const emissionProposal = read('supabase/proposals/20261119_atomic_global_emission_allocator_v13_review.sql')
const emissionRegistry = read('lib/server/economy/emission-registry.ts')
const finalAudit = read('lib/server/release/final-audit.ts')
if (!existsSync(new URL('../.env.example', import.meta.url))) {
  console.error('[RUN376] Required .env.example is missing from the deployment source. Check .vercelignore and ensure the safe template is committed.');
  process.exit(1);
}
const envExample = read('.env.example')
const envDocs = read('docs/ENVIRONMENT-VARIABLES.md')
const withdrawal = read('lib/server/economy/withdrawal.ts')
const withdrawalRoute = read('app/api/economy/withdrawals/route.ts')
const curationRoute = read('app/api/social/posts/[id]/curation/route.ts')
const run376Doc = read('docs/RUN376-ECONOMY-CURATION-WITHDRAWAL-HARDENING-2026-11-19.md')
const checks = [
  ['curation anti-whale cap redistributes excess influence against final total', /water-filling cap/.test(settlement) && /effectiveCapShare/.test(settlement) && /Math\.max\(MAX_REVIEWER_CONSENSUS_SHARE, 1 \/ count\)/.test(settlement)],
  ['duplicate reviewer identities are excluded from consensus quorum', /uniqueReviewerVotes\(input\.votes\)/.test(settlement) && /counts\.get\(id\) === 1/.test(settlement)],
  ['GHPV settlement remains gated until durable per-reviewer daily calibration state exists', /GH_GHPV_CALIBRATION_DAILY_CAP_V2_ENABLED !== \"true\"/.test(settleService) && /day_delta_abs/.test(run376Doc) && /GH_GHPV_CALIBRATION_DAILY_CAP_V2_ENABLED=false/.test(envExample)],
  ['settlement snapshot rejects malformed or oversized vote lists', /SNAPSHOT_VOTE_LIMIT_EXCEEDED/.test(settleService) && /INVALID_SNAPSHOT_VOTE/.test(settleService)],
  ['calibration read failure stops settlement instead of default-overwriting scores', /CALIBRATION_STATE_UNAVAILABLE/.test(settleService) && /timeoutMs: 8_000/.test(settleService)],
  ['settlement snapshot identity is bound to requested content', /SNAPSHOT_CONTENT_MISMATCH/.test(settleService)],
  ['settlement operator trigger has a durable per-content rate limit', /ghpv-settlement:\$\{postId\}/.test(settleRoute) && /onUnavailable: "deny"/.test(settleRoute)],
  ['database-backed eligible population failure is fail-closed', /ECONOMIC_POPULATION_UNAVAILABLE/.test(population)],
  ['daily claim maps population unavailability to service unavailable', /ECONOMIC_POPULATION_UNAVAILABLE/.test(claim) && /SERVER_UNAVAILABLE/.test(claim)],
  ['DB-backed daily claim ignores caller-supplied population overrides', /isDatabaseConfigured\(\)\s*\?\s*await resolveEligibleEconomicUsers\(\)/.test(claim)],
  ['activity issuance requires fresh database population metrics', /resolveEconomicPopulation\(\)/.test(activity) && /ECONOMIC_POPULATION_UNAVAILABLE/.test(activity)],
  ['DB-backed activity issuance ignores caller-supplied population overrides', /Ignore any caller-supplied population/.test(activity)],
  ['activity issuance refuses to grant GHC when atomic demand reservation fails', /!grant.ok/.test(activity) && /ACTIVITY_DURABLE_UNAVAILABLE/.test(activity) && /durableTryActivityEmission/.test(activity)],
  ['atomic activity response rejects malformed amounts and governor fields', /ACTIVITY_EMISSION_RESPONSE_INVALID/.test(durable) && /expectedBudget/.test(durable) && /expectedG/.test(durable)],
  ['daily claim v13 response independently verifies curve, governor, gross and 80/20 split', /expectedM/.test(economyDb) && /expectedBudget/.test(economyDb) && /expectedGross/.test(economyDb) && /expectedUser/.test(economyDb)],
  ['legacy split read/write activity demand helpers are removed', !/durableGetGlobalDemand|durableRecordGlobalDemand|durableTryActivityGrant/.test(durable)],
  ['daily claims use the atomic v13 database allocator, not process-memory demand', /rpcExecuteDailyClaimV13/.test(dailyRoute) && !/rpcExecuteDailyClaimV12/.test(dailyRoute) && !/recordEmissionDemand\(/.test(dailyRoute)],
  ['daily claim v13 is fail-closed behind an explicit operator gate', /GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED !== \"true\"/.test(dailyRoute)],
  ['emission registry classifies daily claim as operator-gated rather than enabled', /policyStatus: \"operator_gated_issuance\"/.test(emissionRegistry) && /GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED=true/.test(emissionRegistry)],
  ['final release audit surfaces atomic-emission operator gate', /check\(\"atomic-emission\"/.test(finalAudit) && /GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED/.test(finalAudit)],
  ['final release audit surfaces curation redistribution v2 operator gate', /check\(\"curation-redistribution\"/.test(finalAudit) && /GHC_CURATION_REDISTRIBUTE_V2_ENABLED/.test(finalAudit)],
  ['financial feature flags default off and are documented', /GHC_WITHDRAWALS_ENABLED=false/.test(envExample) && /GHC_WITHDRAWAL_GHC_PER_PI=/.test(envExample) && /GHC_WITHDRAWALS_TESTNET_ONLY=false/.test(envExample) && /GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED=false/.test(envExample) && /GHC_CURATION_REDISTRIBUTE_V2_ENABLED=false/.test(envExample) && /GHC_TESTNET_UNLOCK=0/.test(envExample) && /GHC_BUY_WITH_PI_ENABLED=false/.test(envExample) && /GHC_ACTIVITY_REWARDS_ENABLED=0/.test(envExample) && /GHC_REFERRAL_SETTLEMENT_ENABLED=0/.test(envExample) && /GHC_MARKETPLACE_GHC_PAYOUTS_ENABLED=false/.test(envExample) && /GHC_TIPS_ENABLED=false/.test(envExample) && /RUN376 atomic allocator proposal/.test(envDocs)],
  ['activity emissions use one atomic per-user cap plus global-demand RPC', /durableTryActivityEmission/.test(activity) && !/durableTryActivityGrant|durableReserveGlobalDemand|durableGetGlobalDemand|durableRecordGlobalDemand/.test(activity)],
  ['activity emission v13 is fail-closed behind the same operator gate', /GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED/.test(activity)],
  ['atomic emission SQL serializes daily demand and calls v12 in the same transaction', /pg_advisory_xact_lock\(hashtext\('ghc_global_emission:'/.test(emissionProposal) && /ghc_execute_daily_claim_v12/.test(emissionProposal)],
  ['atomic activity SQL rolls back user caps when global demand reservation fails', /ghc_activity_try_emission_v2/.test(emissionProposal) && /RAISE EXCEPTION[\s\S]*GLOBAL_EMISSION_RESERVATION_FAILED/.test(emissionProposal) && /ghc_activity_try_grant/.test(emissionProposal)],
  ['activity SQL preserves the canonical 0.5 daily and 2.5 weekly caps', /p_daily_cap IS DISTINCT FROM 0\.5/.test(emissionProposal) && /p_weekly_cap IS DISTINCT FROM 2\.5/.test(emissionProposal)],
  ['shared demand allocator validates day keys and pins SECURITY DEFINER search paths', /to_char\(to_date\(p_day_key/.test(emissionProposal) && /SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog, public/.test(emissionProposal)],
  ['atomic allocator backfills legacy daily-claim demand idempotently', /ghc_global_emission_backfill_v1/.test(emissionProposal) && /ON CONFLICT \(day_key\) DO NOTHING/.test(emissionProposal) && /applied_at IS NULL/.test(emissionProposal)],
  ['atomic allocator functions are SECURITY DEFINER with fixed search_path and service-role-only execution', (emissionProposal.match(/SECURITY DEFINER/g) || []).length >= 3 && (emissionProposal.match(/SET search_path = pg_catalog, public/g) || []).length >= 3 && (emissionProposal.match(/GRANT EXECUTE ON FUNCTION[\s\S]*?TO service_role/g) || []).length >= 3],
  ['atomic emission proposal remains review-only and outside canonical migrations', /DO NOT paste this proposal/.test(emissionProposal) && !read('MIGRATION-SOURCE-MANIFEST.csv').includes('20261119_atomic_global_emission_allocator_v13_review.sql')],
  ['GHC-to-Pi withdrawals require explicit Testnet-only enablement', /GHC_WITHDRAWALS_TESTNET_ONLY === "true"/.test(withdrawal) && /PI_NETWORK === "testnet"/.test(withdrawal)],
  ['withdrawal route requires request-bound PIN proof', /checkPinProof\(auth\.userId, idempotencyKey, pinProof\)/.test(withdrawalRoute)],
  ['withdrawal route requires verified mapped Pi identity and platform wallet address', /assertPayoutWalletAuthorization/.test(withdrawalRoute) && /walletAddressSource !== "platform_api"/.test(withdrawalRoute)],
  ['withdrawal route compares destination against the verified wallet', /verifiedWallet/.test(withdrawalRoute) && /walletAddressSource !== "platform_api"/.test(withdrawalRoute)],
  ['withdrawal domain independently validates address, idempotency, feature gate and minimum amount', /isValidPiWithdrawalAddress\(wallet\)/.test(withdrawal) && /INVALID_WITHDRAWAL_INPUT/.test(withdrawal) && /areGhcPiWithdrawalsEnabled\(\)/.test(withdrawal) && /BELOW_MINIMUM/.test(withdrawal)],
  ['balance-funded curation redistribution validates identities, four-decimal SQL precision and the SQL one-GHC cap', /voterId === authorId/.test(redistribution) && /amount > 1/.test(redistribution) && /10_000/.test(redistribution) && /ghc_curation_redistribute_v2/.test(redistribution)],
  ['curation redistribution stays disabled until the idempotency-safe wrapper is explicitly enabled', /GHC_CURATION_REDISTRIBUTE_V2_ENABLED === \"true\"/.test(redistribution) && /GHC_CURATION_REDISTRIBUTE_V2_ENABLED=false/.test(envExample)],
  ['curation route rounds percentage-derived amounts to the deployed four-decimal SQL precision', /Math\.round\(Math\.min\(1, Math\.max\(0, \(Number\(rewardPercentage\) \/ 100\) \* 0\.1\)\) \* 10_000\) \/ 10_000/.test(curationRoute)],
  ['curation redistribution v2 returns the original ledger amount on idempotent replay', /ghc_curation_redistribute_v2/.test(read('supabase/proposals/20261119_curation_redistribute_v2_idempotency_review.sql')) && /requestAmountMismatch/.test(read('supabase/proposals/20261119_curation_redistribute_v2_idempotency_review.sql')) && /abs\(v_existing.amount\)/.test(read('supabase/proposals/20261119_curation_redistribute_v2_idempotency_review.sql'))],
  ['curation redistribution v2 pins search_path and grants execution only to service_role', /SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog, public/.test(read('supabase/proposals/20261119_curation_redistribute_v2_idempotency_review.sql')) && /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/.test(read('supabase/proposals/20261119_curation_redistribute_v2_idempotency_review.sql')) && /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/.test(read('supabase/proposals/20261119_curation_redistribute_v2_idempotency_review.sql'))],
  ['curation redistribution uses an explicit bounded database deadline', /timeoutMs: 8_000/.test(redistribution)],
  ['curation redistribution rejects malformed upstream amount/balance data', /CURATION_REDISTRIBUTION_RESPONSE_INVALID/.test(redistribution)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nRUN376 economy/curation integrity: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
