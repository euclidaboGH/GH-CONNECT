#!/usr/bin/env node
/** Phase 3 closeout source contract. Static only; does not contact Pi or mutate a database. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const sql = read('supabase/migrations/20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql')
const cancel = read('app/api/economy/earnings/withdrawals/cancel/route.ts')
const create = read('app/api/economy/earnings/withdrawals/route.ts')
const recovery = read('app/api/payments/intents/[intentId]/recover/route.ts')
const pkg = JSON.parse(read('package.json'))
const release = read('lib/app-release.ts')
const ledger = read('components/ghc/unified-earnings-dashboard.tsx')
const wallet = read('features/wallet/wallet-balance.tsx')
const membership = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.ghc_purchase_membership'))
const claim = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.ghc_claim_pending'))
const checks = [
  ['payout cancellation serializes by authenticated account key', /pi_earnings_payout:' \|\| v_user/.test(sql)],
  ['payout cancellation locks each durable request row', /ORDER BY created_at\s+FOR UPDATE/.test(sql)],
  ['payout recovery is restricted to Pi Testnet', /network = 'Pi Testnet'/.test(sql)],
  ['only reserved requests are eligible for self-service release', /v_row\.status = 'reserved'/.test(sql)],
  ['provider payment id must be absent before release', /v_row\.provider_payment_id IS NULL/.test(sql)],
  ['provider txid must be absent before release', /v_row\.provider_txid IS NULL/.test(sql)],
  ['execution must not have started before release', /v_row\.execution_started_at IS NULL/.test(sql)],
  ['execution lease must be absent before release', /v_row\.execution_lease_token IS NULL/.test(sql)],
  ['execution attempts must remain zero before release', /COALESCE\(v_row\.execution_attempts, 0\) = 0/.test(sql)],
  ['release returns the exact gross amount to the matching request', /v_row\.gross_atomic[\s\S]*?v_row\.id::text/.test(sql)],
  ['request is marked released only after ledger release succeeds', /IF COALESCE\(\(v_rel->>'ok'\)::boolean, false\) IS NOT TRUE THEN[\s\S]*?UPDATE public\.gh_pi_earnings_payout_requests[\s\S]*?status = 'released'/.test(sql)],
  ['uncertain provider outcomes are never force-released', /v_row\.status = 'uncertain'[\s\S]*?PROVIDER_OUTCOME_UNKNOWN/.test(sql)],
  ['processing provider outcomes remain reserved', /v_row\.status = 'processing'[\s\S]*?PROVIDER_EXECUTION_IN_PROGRESS/.test(sql)],
  ['started-but-reserved requests have an explicit hold reason', /EXECUTION_ALREADY_STARTED/.test(sql)],
  ['API returns per-request explanations', /items: r\.items \|\| \[\]/.test(cancel)],
  ['API returns the server recovery guidance', /message: r\.message \|\| null/.test(cancel)],
  ['API is authenticated before cancellation', cancel.slice(cancel.indexOf('export async function POST')).indexOf('if (!auth)') < cancel.slice(cancel.indexOf('export async function POST')).indexOf('cancelUnstartedPayoutRequests')],
  ['API applies a durable fail-closed account rate limit', /checkDurableRateLimit[\s\S]*?onUnavailable: "deny"/.test(cancel)],
  ['API responses are non-cacheable', /private, no-store/.test(cancel)],
  ['wallet presents the reason for each held reservation', /item\.reason/.test(wallet)],
  ['wallet presents the exact unlock condition', /item\.unlockCondition/.test(wallet)],
  ['wallet distinguishes safe immediate release from provider reconciliation', /Safety rule:[\s\S]*?authoritative cancellation with no transaction/.test(wallet)],
  ['wallet ledger shows the human reason before opaque reference', /e\.reason \|\| e\.unique_ref/.test(ledger)],
  ['withdrawal response no longer claims execution is disabled after passing the execution gate', !/execution is not enabled in this release/i.test(create)],
  ['membership purchase serializes preflight and debit per account', /ghc_membership_purchase:' \|\| p_user_id/.test(membership)],
  ['membership entitlement row is locked before deciding to debit', /FROM public\.ghc_membership_entitlements\s+WHERE user_id = p_user_id\s+FOR UPDATE/.test(membership)],
  ['same active membership tier cannot be charged again in a concurrent race', /alreadyActive', true/.test(membership) && /v_existing\.tier = p_row->>'tier'/.test(membership)],
  ['active VVIP cannot be downgraded through a concurrent GHC purchase', /MEMBERSHIP_DOWNGRADE_NOT_ALLOWED/.test(membership)],
  ['reward claim retry resolves the expired pending row by rewardId alias', /metadata->>'rewardId' = p_hold_id/.test(claim)],
  ['reward claim serializes concurrent duplicate rewardId aliases', /ghc_claim_pending:' \|\| p_user_id[\s\S]*?COALESCE\(v_reward_id, v_ref\)/.test(claim)],
  ['reward claim refuses a second posted credit for the same canonical rewardId', /metadata->>'rewardId' = v_reward_id/.test(claim) && /'rewardId', v_reward_id/.test(claim)],
  ['reward claim replay only returns a matching posted credit owned by the user', /user_id = p_user_id AND reference_id = v_pending\.reference_id[\s\S]*?kind = 'earned' AND status = 'posted'/.test(claim)],
  ['Pi recovery performs provider lookup before binding the payment ID', recovery.indexOf('await piGetPayment(paymentId)') < recovery.indexOf('await bindProviderPayment(intentId, paymentId, auth.userId)')],
  ['Pi recovery verifies payment direction and environment network', /payment\.direction !== "user_to_app"/.test(recovery) && /payment\.network !== expectedNetwork/.test(recovery)],
  ['Pi recovery binds the provider payer to the authenticated Pi identity', /getByGhUserId\(auth\.userId\)/.test(recovery) && /payerUid !== identity\.piAppUid/.test(recovery)],
  ['Pi recovery checks exact provider identifier and amount before binding', /payment\.identifier !== paymentId/.test(recovery) && /amountsMatch\(intent\.amount, payment\.amount\)/.test(recovery)],
  ['Pi recovery requires transaction verification and txid before completing', /st\.transaction_verified === true/.test(recovery) && /!providerTxid/.test(recovery) && recovery.indexOf('!verified || !providerTxid') < recovery.indexOf('transitionIntent(intentId, "COMPLETED"')],
  ['Pi recovery retains ambiguous provider outcomes for retry instead of marking paid', /PI_PAYMENT_NOT_VERIFIED/.test(recovery) && /retryable: true/.test(recovery)],
  ['Pi recovery is rate limited and fails closed when durable protection is unavailable', /pi-payment-recover:\$\{auth\.userId\}/.test(recovery) && /onUnavailable: "deny"/.test(recovery)],
  ['Pi recovery uses private no-store responses', /private, no-store/.test(recovery) && !/return NextResponse\.json\(/.test(recovery)],
  ['closeout contract is wired into prebuild and static verification exactly once', (pkg.scripts['prebuild:checks'].match(/check-phase3-wallet-rewards-membership-closeout\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-phase3-wallet-rewards-membership-closeout\.mjs/g) || []).length === 1],
  ['in-app release notice exports a synchronized version and summary', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && /export const APP_RELEASE_SUMMARY/.test(release)],
  ['membership and reward RPCs remain service-role only', /GRANT EXECUTE ON FUNCTION public\.ghc_purchase_membership[\s\S]*?TO service_role/.test(sql) && /GRANT EXECUTE ON FUNCTION public\.ghc_claim_pending[\s\S]*?TO service_role/.test(sql)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 3 wallet/rewards/membership closeout: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
