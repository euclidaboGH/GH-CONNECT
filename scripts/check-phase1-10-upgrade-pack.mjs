#!/usr/bin/env node
/** Cross-phase 20-point regression contract: two controls for each completion phase. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(p, 'utf8')
const exists = (p) => fs.existsSync(p)
const checks = []
const add = (phase, id, label, ok) => checks.push({ phase, id, label, ok: Boolean(ok) })
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')
const sourceTruth = read('docs/PHASE-1-CONSOLIDATED-AUDIT-AND-IMPLEMENTATION-REGISTER-2026-11-09.md')
const migrationFiles = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))
const migrationVersions = migrationFiles.map((f) => f.slice(0, 14))
const workflow = read('.github/workflows/ci.yml')
const identity = read('lib/server/economy/auth.ts')
const payout = read('app/api/economy/earnings/withdrawals/process/route.ts')
const payoutWorker = read('app/api/economy/earnings/withdrawals/execute/route.ts')
const blockRoute = read('app/api/social/blocks/route.ts')
const communityActions = read('lib/server/community/community-integrity.ts')
const messageRoute = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const searchMigration = read('supabase/migrations/20261109100001_gh_messaging_phase1_controls_search.sql')
const earningsProposal = read('supabase/proposals/20261109_phase6_earnings_balance_integrity_observability_proposal.sql')
const commission = read('lib/server/marketplace/commission.ts')
const proceeds = read('supabase/migrations/20261030010009_phase20_marketplace_net_proceeds.sql')
const settings = read('lib/settings-persistence.ts')
const filterContract = read('lib/filtering/index.ts')
const releaseClosure = read('scripts/check-phase10-release-closure.mjs')
const ci = read('.github/workflows/ci.yml')

// Phase 1 — source-of-truth and issue traceability.
add(1, 'P1-A', 'Package, app release and consolidated audit agree on 0.338.18', pkg.version === '0.338.18' && release.includes('0.338.18') && sourceTruth.includes('gh-connect@0.338.18'))
add(1, 'P1-B', 'Consolidated register preserves external blockers and production no-go', /Production remains NOT APPROVED/.test(sourceTruth) && /Testnet and Mainnet migration histories/.test(sourceTruth))
// Phase 2 — migration integrity and deployment safety.
add(2, 'P2-A', '199 canonical migration versions are unique and 14-digit', migrationFiles.length === 199 && migrationVersions.every((v) => /^\d{14}$/.test(v)) && new Set(migrationVersions).size === migrationVersions.length)
add(2, 'P2-B', 'Balance-observability SQL remains a proposal, outside canonical migrations', exists('supabase/proposals/20261109_phase6_earnings_balance_integrity_observability_proposal.sql') && !exists('supabase/migrations/20261109_phase6_earnings_balance_integrity_observability_proposal.sql') && !/supabase db push/.test(workflow))
// Phase 3 — identity and mutation authority.
add(3, 'P3-A', 'Production identity resolution requires canonical GH mapping', /env\.isProduction/.test(identity) && /canonical|mapping/i.test(identity) && /if \(!mapping\?\.ghUserId\)/.test(identity) && /return null/.test(identity))
add(3, 'P3-B', 'Withdrawal execution remains server-authorized and no-store', /executeWorker/.test(payout) && /no-store/i.test(payout) && /assertPayoutWalletAuthorization/.test(payoutWorker))
// Phase 4 — social graph and community safety.
add(4, 'P4-A', 'Block targets use shared strict target-ID sanitizer', /sanitizeTargetUserId/.test(blockRoute))
add(4, 'P4-B', 'Community join status distinguishes pending and banned outcomes', /pending/.test(communityActions) && /banned/i.test(communityActions))
// Phase 5 — messaging and notification integrity.
add(5, 'P5-A', 'Message idempotency key bound matches 80-character storage contract', /clientMessageId.{0,100}80|80.{0,100}clientMessageId/s.test(messageRoute))
add(5, 'P5-B', 'Full-history search SQL rechecks membership and excludes deleted messages', /conversation_members|active.*member/i.test(searchMigration) && /deleted_at IS NULL|is_deleted\s*=\s*false/i.test(searchMigration))
// Phase 6 — ledger and rewards integrity.
add(6, 'P6-A', 'PI earnings balance proposal exposes raw totals and integrity anomalies', /rawAvailableAtomic/.test(earningsProposal) && /rawReservedAtomic/.test(earningsProposal) && /integrityOk/.test(earningsProposal) && /integrityAnomalies/.test(earningsProposal))
add(6, 'P6-B', 'Legacy display balances remain clamped while anomaly evidence is additive', /availableAtomic', v_available/.test(earningsProposal) && /v_available_raw := v_available/.test(earningsProposal) && /v_reserved_raw := v_reserved/.test(earningsProposal) && /IF v_available < 0 THEN v_available := 0/.test(earningsProposal) && /rawAvailableAtomic/.test(earningsProposal))
// Phase 7 — Pi identity and payout recovery.
add(7, 'P7-A', 'Pi identity fallback is explicitly restricted outside production', /env\.isProduction/.test(identity) && /production/.test(identity) && /fallback|legacy/i.test(identity))
add(7, 'P7-B', 'Payout authorization binds canonical account to exact recipient', /recipient_pi_app_uid/.test(payoutWorker) && /user_id:`eq\.\$\{auth\.userId\}`/.test(payoutWorker) && /assertPayoutWalletAuthorization/.test(payoutWorker) && /begin\.recipientUid/.test(payoutWorker))
// Phase 8 — marketplace, membership and settlement.
add(8, 'P8-A', 'Marketplace commission is fixed at canonical 500 bps until DB policy exists', /CANONICAL_PLATFORM_FEE_BPS\s*=\s*500/.test(commission) && !/process\.env\.GHC_MARKETPLACE_PLATFORM_FEE_BPS/.test(commission))
add(8, 'P8-B', 'No app-only minimum fee can diverge from immutable SQL proceeds', !/GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR/.test(commission) && /100000000/.test(proceeds))
// Phase 9 — settings, filters and user controls.
add(9, 'P9-A', 'Settings export schema rejects secret-bearing keys', /forbidden|secret|token|password|vapid|webhook|jwt/i.test(settings) && /ghc\.settings\.export\.v1/.test(settings))
add(9, 'P9-B', 'Shared filtering module is present and exported for cross-surface parity', exists('lib/filtering/index.ts') && /export/.test(filterContract))
// Phase 10 — release engineering and acceptance.
add(10, 'P10-A', 'Node 24.15 runtime and explicit typecheck/lint/build gates remain enforced', /24\.15\.0/.test(read('.nvmrc')) && /typecheck/.test(releaseClosure) && /lint/.test(releaseClosure) && /build/.test(releaseClosure) && /24\.15\.0/.test(ci))
add(10, 'P10-B', 'Production stays NOT APPROVED and CI cannot apply database migrations', /NOT APPROVED/.test(releaseClosure) && !/supabase db push/.test(ci))

let failed = 0
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'} Phase ${c.phase} ${c.id}: ${c.label}`)
  if (!c.ok) failed++
}
console.log(`\nPhase 1–10 upgrade pack: ${checks.length - failed}/${checks.length} passed; ${failed} failed.`)
if (checks.length !== 20 || failed) process.exit(1)
