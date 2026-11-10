#!/usr/bin/env node
/** Static guard: server-enforced withdrawal PIN, atomic attempt accounting, recovery and self-service release. */
import { readFileSync, existsSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const withdrawals = read('app/api/economy/earnings/withdrawals/route.ts')
const pinRoute = read('app/api/identity/withdrawal-pin/route.ts')
const pinLib = read('lib/server/identity/withdrawal-pin.ts')
const proof = read('lib/server/identity/withdrawal-pin-proof.ts')
const recovery = read('lib/server/identity/pin-recovery.ts')
const recoveryRoute = read('app/api/identity/pin-recovery/route.ts')
const cancel = read('app/api/economy/earnings/withdrawals/cancel/route.ts')
const sheet = read('components/ghc/pi-withdraw-sheet.tsx')
const mig = read('supabase/migrations/20261107130001_wallet_security_hardening.sql')
const recMig = read('supabase/migrations/20261107120001_withdrawal_pin_recovery_questions.sql')
const atomicMig = read('supabase/migrations/20261110100001_withdrawal_rpc_acl_and_recovery_atomicity.sql')
const raceMig = read('supabase/migrations/20261110110001_wallet_recovery_reset_lock_race_guard.sql')
const env = read('.env.example')
const checks = [
  ['withdrawals route requires a server-issued PIN proof before reserving funds', /checkPinProof\(auth\.userId, key, body\.pinProof\)/.test(withdrawals) && withdrawals.indexOf('checkPinProof') < withdrawals.indexOf('quoteWithdrawal(')],
  ['PIN proof is HMAC-bound to user + idempotency key, expires, and fails closed without a secret', /createHmac\("sha256"/.test(proof) && /exp < Date\.now\(\)/.test(proof) && /pinProofConfigured\(\)/.test(proof) && /GH_PIN_PROOF_SECRET/.test(env)],
  ['PIN verify counts attempts atomically before comparing (no read-then-write race)', /gh_withdrawal_pin_begin_attempt/.test(pinLib) && /FOR UPDATE/.test(mig) && !/failed_attempts:\s*attempts/.test(pinLib)],
  ['PIN and recovery routes use durable fail-closed rate limits', /checkDurableRateLimit\([^)]*onUnavailable: "deny"/.test(pinRoute) && /checkDurableRateLimit\([^)]*onUnavailable: "deny"/.test(recoveryRoute) && !/checkRateLimit\(/.test(pinRoute + recoveryRoute)],
  ['weak PINs are rejected on setup and recovery reset', /isWeakPin/.test(pinRoute) && /isWeakPin/.test(recoveryRoute)],
  ['PIN tables use text user ids without an auth.users foreign key', /user_id text PRIMARY KEY/.test(recMig) && /ALTER COLUMN user_id TYPE text/.test(mig)],
  ['recovery answers are stored only as per-answer salted scrypt hashes; reset enforces a 24h cooldown in the atomic database RPC', /scryptSync/.test(recovery) && /randomBytes\(16\)/.test(recovery) && /answers jsonb/.test(recMig) && /reset_cooldown_until = now\(\) \+ interval '24 hours'/.test(atomicMig) && /PIN_COOLDOWN/.test(mig)],
  ['recovery tables and new functions are service-role only', /ENABLE ROW LEVEL SECURITY/.test(recMig) && /REVOKE ALL ON TABLE public\.gh_withdrawal_pin_recovery FROM PUBLIC, anon, authenticated, service_role/.test(atomicMig) && /GRANT EXECUTE ON FUNCTION public\.gh_withdrawal_pin_recovery_reset_pin\(text, text, text\) TO service_role/.test(atomicMig) && /REVOKE ALL ON FUNCTION public\.gh_pi_earnings_payout_cancel_unstarted/.test(mig)],
  ['self-service release only touches unstarted Testnet reservations', /provider_payment_id IS NULL/.test(mig) && /execution_started_at IS NULL/.test(mig) && /network = 'Pi Testnet'/.test(mig) && /cancelUnstartedPayoutRequests\(auth\.userId\)/.test(cancel)],
  ['withdraw sheet binds the PIN proof to the idempotency key and never shows operator-only errors', /bindKey: pinIntent\.key/.test(sheet) && /pinProof/.test(sheet) && !/Operator must apply/.test(sheet)],
  ['new migrations are registered with the generator', existsSync('supabase/migrations/20261107130001_wallet_security_hardening.sql') && /20261107130001_wallet_security_hardening\.sql/.test(read('scripts/generate-migration-inventory.mjs')) && existsSync('supabase/migrations/20261110110001_wallet_recovery_reset_lock_race_guard.sql') && /20261110110001_wallet_recovery_reset_lock_race_guard\.sql/.test(read('scripts/generate-migration-inventory.mjs'))],
  ['recovery reset re-checks the recovery lock under row lock and does not extend an active cooldown', /FROM public\.gh_withdrawal_pin_recovery[\s\S]*FOR UPDATE[\s\S]*v_recovery\.locked_until/.test(raceMig) && /FROM public\.gh_withdrawal_pins[\s\S]*FOR UPDATE[\s\S]*v_pin\.reset_cooldown_until/.test(raceMig)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1 }
console.log(`Wallet security hardening: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
