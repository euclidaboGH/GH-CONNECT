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
const env = read('.env.example')
const checks = [
  ['withdrawals route requires a server-issued PIN proof before reserving funds', /checkPinProof\(auth\.userId, key, body\.pinProof\)/.test(withdrawals) && withdrawals.indexOf('checkPinProof') < withdrawals.indexOf('quoteWithdrawal(')],
  ['PIN proof is HMAC-bound to user + idempotency key, expires, and fails closed without a secret', /createHmac\("sha256"/.test(proof) && /exp < Date\.now\(\)/.test(proof) && /pinProofConfigured\(\)/.test(proof) && /GH_PIN_PROOF_SECRET/.test(env)],
  ['PIN verify counts attempts atomically before comparing (no read-then-write race)', /gh_withdrawal_pin_begin_attempt/.test(pinLib) && /FOR UPDATE/.test(mig) && !/failed_attempts:\s*attempts/.test(pinLib)],
  ['PIN and recovery routes use durable fail-closed rate limits', /checkDurableRateLimit\([^)]*onUnavailable: "deny"/.test(pinRoute) && /checkDurableRateLimit\([^)]*onUnavailable: "deny"/.test(recoveryRoute) && !/checkRateLimit\(/.test(pinRoute + recoveryRoute)],
  ['weak PINs are rejected on setup and recovery reset', /isWeakPin/.test(pinRoute) && /isWeakPin/.test(recoveryRoute)],
  ['PIN tables use text user ids without an auth.users foreign key', /user_id text PRIMARY KEY/.test(recMig) && /ALTER COLUMN user_id TYPE text/.test(mig)],
  ['recovery answers are stored only as salted scrypt hashes and recovery reset adds a 24h cooldown', /scryptSync/.test(recovery) && /reset_cooldown_until/.test(recovery) && /answers jsonb/.test(recMig)],
  ['recovery tables and new functions are service-role only', /ENABLE ROW LEVEL SECURITY/.test(recMig) && /REVOKE ALL ON FUNCTION public\.gh_pi_earnings_payout_cancel_unstarted/.test(mig)],
  ['self-service release only touches unstarted Testnet reservations', /provider_payment_id IS NULL/.test(mig) && /execution_started_at IS NULL/.test(mig) && /network = 'Pi Testnet'/.test(mig) && /cancelUnstartedPayoutRequests\(auth\.userId\)/.test(cancel)],
  ['withdraw sheet binds the PIN proof to the idempotency key and never shows operator-only errors', /bindKey: pinIntent\.key/.test(sheet) && /pinProof/.test(sheet) && !/Operator must apply/.test(sheet)],
  ['new migrations are registered with the generator', existsSync('supabase/migrations/20261107130001_wallet_security_hardening.sql') && /20261107130001_wallet_security_hardening\.sql/.test(read('scripts/generate-migration-inventory.mjs'))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1 }
console.log(`Wallet security hardening: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
