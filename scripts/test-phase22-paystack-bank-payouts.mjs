import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const read = (p) => fs.readFileSync(path.resolve(p), 'utf8')
const provider = read('lib/server/payouts/paystack.ts')
const banks = read('app/api/marketplace/payouts/banks/route.ts')
const resolve = read('app/api/marketplace/payouts/bank-account/resolve/route.ts')
const beneficiaries = read('app/api/marketplace/payouts/bank-beneficiaries/route.ts')
const requests = read('app/api/marketplace/payouts/bank-requests/route.ts')
const execute = read('app/api/marketplace/payouts/[requestId]/execute-bank/route.ts')
const transition = read('app/api/marketplace/payouts/[requestId]/transition-bank/route.ts')
const resolveException = read('app/api/marketplace/payouts/[requestId]/resolve-bank-exception/route.ts')
const reconcile = read('app/api/marketplace/payouts/[requestId]/reconcile-bank/route.ts')
const webhook = read('app/api/webhooks/paystack/route.ts')
const migration = read('supabase/migrations/202610250008_paystack_ngn_beneficiaries_and_payouts.sql')
const env = read('.env.example')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['missed webhook recovery queries Paystack by durable provider reference', reconcile.includes('fetchNgnTransfer(reference)') && reconcile.includes('gh_bank_payout_apply_reconciliation')],
  ['reconciliation refuses client-supplied provider status and verifies exact amount/currency/reference', reconcile.includes('transfer.reference !== reference') && reconcile.includes('transfer.amount !== amountKobo') && reconcile.includes('transfer.currency !== \"NGN\"')],
  ['Paystack adapter is pinned to HTTPS provider API', provider.includes('https://api.paystack.co')],
  ['Transfers require explicit feature gate and valid key prefix', provider.includes('PAYSTACK_TRANSFERS_ENABLED === "true"') && provider.includes('sk_test_') && provider.includes('sk_live_')],
  ['live transfers require explicit live approval', provider.includes('PAYSTACK_LIVE_TRANSFERS_APPROVED === "true"')],
  ['webhook signature uses HMAC-SHA512 and timing-safe comparison', provider.includes('createHmac("sha512"') && provider.includes('timingSafeEqual')],
  ['bank list requires authenticated user and is rate limited', banks.includes('resolveAuthenticatedUser') && banks.includes('checkRateLimit')],
  ['account resolution requires step-up and validates NUBAN', resolve.includes('requireRecentStepUp') && resolve.includes('/^\\d{10}$/')],
  ['beneficiary creation re-resolves account name before provider creation', beneficiaries.includes('resolveNubanAccount') && beneficiaries.includes('ACCOUNT_HOLDER_NAME_MISMATCH')],
  ['beneficiaries can be disabled only by owner with step-up and no in-flight payout', beneficiaries.includes('export async function DELETE') && beneficiaries.includes('requireRecentStepUp') && migration.includes('gh_bank_beneficiary_disable') && migration.includes('BENEFICIARY_HAS_IN_FLIGHT_PAYOUT')],
  ['beneficiary fingerprints use server-only HMAC key', beneficiaries.includes('GHC_BENEFICIARY_FINGERPRINT_KEY') && beneficiaries.includes('createHmac("sha256"')],
  ['raw bank account number is not persisted', !/account_number\s*:\s*accountNumber/.test(beneficiaries.slice(beneficiaries.indexOf('const payload'), beneficiaries.indexOf('const response')))],
  ['beneficiary rows store provider code and masked account only', beneficiaries.includes('provider_recipient_code') && beneficiaries.includes('account_last4')],
  ['payout requests require a durable NGN obligation', requests.includes('p_obligation_id') && requests.includes('gh_bank_payout_request')],
  ['bank payout history is user-scoped and rate limited', requests.includes('export async function GET') && requests.includes('seller_id: `eq.${auth.userId}`') && requests.includes('payout-bank-history')],
  ['bank execution requires privileged auth and live approval gate', execute.includes('GHC_PAYOUT_RECONCILIATION_KEY') && execute.includes('paystackLiveTransfersApproved()')],
  ['single-transfer and UTC daily limits must be configured and atomically reserved', execute.includes('PAYSTACK_MAX_TRANSFER_KOBO') && execute.includes('PAYSTACK_DAILY_TRANSFER_LIMIT_KOBO') && migration.includes('gh_bank_payout_daily_limits') && migration.includes('PAYOUT_DAILY_LIMIT_EXCEEDED')],
  ['bank transfer uses deterministic DB-returned reference on retry', execute.includes('gh_bank_payout_begin_transfer') && execute.includes('providerReference')],
  ['provider submission response never marks payout paid and exposes OTP requirement', execute.includes('recorded.paid === true') && execute.includes('requiresOperatorOtp') && execute.includes('gh_bank_payout_record_submission')],
  ['operator transition cannot mark paid', transition.includes('new Set(["approved", "cancelled"])') && !transition.includes('nextStatus === "paid"')],
  ['failed/reversed obligation release requires audited operator note', resolveException.includes('gh_bank_payout_resolve_exception') && resolveException.includes('note.length < 12') && migration.includes('gh_bank_payout_operator_actions') && migration.includes('prior_obligation_status')],
  ['webhook verifies signature before parsing business event', webhook.indexOf('verifyPaystackSignature(raw') < webhook.indexOf('JSON.parse(raw)')],
  ['only transfer terminal events affect payout records', webhook.includes('transfer.success') && webhook.includes('transfer.failed') && webhook.includes('transfer.reversed')],
  ['webhook binds provider reference, amount, currency and transfer ID', webhook.includes('p_provider_reference') && webhook.includes('p_amount_kobo') && webhook.includes('p_provider_transfer_id')],
  ['beneficiary, obligation, payout and evidence tables are RLS protected', ['gh_bank_beneficiaries','gh_bank_payout_obligations','gh_bank_payout_daily_limits','gh_bank_payout_requests','gh_bank_payout_operator_actions','gh_bank_payout_webhook_events','gh_bank_payout_reconciliations'].every((t) => migration.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`))],
  ['obligation creation requires immutable source reference and evidence hash', migration.includes('source_reference text NOT NULL UNIQUE') && migration.includes('evidence_hash text NOT NULL')],
  ['GHC/PI conversion is explicitly disallowed by design notes', migration.includes('does NOT convert GHC/PI into NGN') && migration.includes('must never be converted into NGN')],
  ['payout request atomically reserves obligation and verified beneficiary', migration.includes('FOR UPDATE') && migration.includes("v_obligation.status<>'available'") && migration.includes("v_beneficiary.status<>'verified'")],
  ['concurrent idempotent requests recheck after acquiring obligation lock', migration.includes('Recheck after the obligation lock so concurrent retries')],
  ['provider reference is deterministic and idempotent', migration.includes("'ghb_'||md5(v_req.id)") && migration.includes('PAYOUT_PROVIDER_REFERENCE_MISSING')],
  ['transfer submission is idempotent if webhook wins the race', migration.includes("v_req.status IN ('paid','failed','reversed')") && migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.gh_bank_payout_record_submission'), migration.indexOf('CREATE OR REPLACE FUNCTION public.gh_bank_payout_apply_webhook')).includes('idempotent')],
  ['only provider webhook evidence can mark payout paid', migration.includes("WHEN 'transfer.success' THEN 'paid'") && migration.includes("SET status=v_next") && migration.includes("SET status='paid',updated_at=now()")],
  ['duplicate Paystack webhook delivery is idempotent by event key', migration.includes('WHERE event_key=trim(p_event_key)') && migration.includes("duplicate',true") && migration.includes("event_key text PRIMARY KEY")],
  ['webhook failure/reversal leaves funds reserved for manual resolution', migration.includes("WHEN 'transfer.failed' THEN 'failed'") && migration.includes("ELSE 'reversed'") && migration.includes('Failed/reversed payouts keep the obligation reserved')],
  ['lost-webhook reconciliation records provider evidence idempotently', migration.includes('ON CONFLICT(payout_request_id,evidence_hash) DO NOTHING') && reconcile.includes('fetchNgnTransfer(reference)') && reconcile.includes('gh_bank_payout_apply_reconciliation')],
  ['provider timeout retries retain the original deterministic reference', execute.includes('providerReference') && migration.includes("'ghb_'||md5(v_req.id)") && execute.includes('gh_bank_payout_begin_transfer')],
  ['failed or reversed transfers are held for manual review', migration.includes('Failed/reversed payouts keep the obligation reserved')],
  ['late success after a retry conflict quarantines both payout attempts', migration.includes('transfer.success_conflict') && migration.includes('reconciled:success_conflict') && migration.includes("status='disputed'")],
  ['all sensitive tables and RPCs are service-role only', migration.includes('REVOKE ALL ON TABLE public.gh_bank_beneficiaries') && migration.includes('REVOKE ALL ON FUNCTION public.gh_bank_payout_apply_webhook') && migration.includes('REVOKE ALL ON FUNCTION public.gh_bank_beneficiary_disable') && migration.includes('REVOKE ALL ON FUNCTION public.gh_bank_payout_apply_reconciliation') && migration.includes('TO service_role')],
  ['bank provider secrets are server-side and disabled by default', env.includes('PAYSTACK_TRANSFERS_ENABLED=false') && !/^NEXT_PUBLIC_.*PAYSTACK_SECRET_KEY/m.test(env)],
  ['bank payout static suite is included in ci:verify', pkg.scripts['ci:verify'].includes('test:phase22-paystack-bank-payouts')],
  ['repository audit runs before the dependency lock gate in ci:verify', pkg.scripts['ci:verify'].startsWith('npm run audit:project-integrity && npm run check:dependency-lock-integrity') && pkg.scripts['check:dependency-lock-integrity'].includes('check-dependency-lock-integrity.mjs')],
]
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); assert.ok(pass, name) }
console.log(`\nPhase 22 Paystack bank payout checks: ${checks.length}/${checks.length} passed.`)
