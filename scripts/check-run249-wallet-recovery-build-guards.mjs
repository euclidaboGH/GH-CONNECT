#!/usr/bin/env node
/** Run #249 regression contracts for withdrawal-PIN recovery and build diagnostics. */
import { readFileSync, existsSync } from 'node:fs'
const read = (file) => readFileSync(file, 'utf8')
const recovery = read('lib/server/identity/pin-recovery.ts')
const route = read('app/api/identity/pin-recovery/route.ts')
const atomic = read('supabase/migrations/20261110100001_withdrawal_rpc_acl_and_recovery_atomicity.sql')
const raceGuard = read('supabase/migrations/20261110110001_wallet_recovery_reset_lock_race_guard.sql')
const pinMigration = read('supabase/migrations/20261107130001_wallet_security_hardening.sql')
const ci = read('.github/workflows/ci.yml')
const oldGate = read('scripts/check-wallet-security-hardening.mjs')
const priorBuildGate = read('scripts/check-run247-build-diagnostics.mjs')
const checks = [
  ['recovery answers use Node scrypt rather than a fast general-purpose digest', /scryptSync\(value/.test(recovery)],
  ['each recovery answer receives an independent 16-byte random salt', /randomBytes\(16\)/.test(recovery)],
  ['answer normalization is Unicode-aware and bounds answer length', /normalize\("NFKD"\)/.test(recovery) && /n\.length >= 2 && n\.length <= 80/.test(recovery)],
  ['stored recovery records validate question IDs, salt and hash encodings', /function isStoredAnswer/.test(recovery) && /\[0-9a-f\]\{32\}/.test(recovery) && /\[0-9a-f\]\{64\}/.test(recovery)],
  ['setup requires exactly three distinct valid questions and usable answers', /questionIds\.length !== QUESTION_COUNT/.test(recovery) && /new Set\(questionIds\)\.size !== QUESTION_COUNT/.test(recovery) && /answers\.every\(isUsableAnswer\)/.test(recovery)],
  ['recovery setup is database insert-only', /ON CONFLICT \(user_id\) DO NOTHING/.test(atomic)],
  ['database independently validates all three answer hash records', /jsonb_array_length\(p_answers\) <> 3/.test(atomic) && /salt.*\[0-9a-f\]\{32\}/s.test(atomic) && /hash.*\[0-9a-f\]\{64\}/s.test(atomic)],
  ['recovery failure accounting serializes concurrent attempts with FOR UPDATE', /gh_withdrawal_pin_recovery_record_failure/.test(atomic) && /WHERE user_id = trim\(p_user_id\) FOR UPDATE/.test(atomic)],
  ['recovery failure attempts and lock duration are bounded by the RPC', /p_max_attempts.*NOT BETWEEN 2 AND 10/.test(atomic) && /p_lock_seconds.*NOT BETWEEN 60 AND 3600/.test(atomic)],
  ['answers are compared with a constant-time comparison', /timingSafeEqual\(actual, expected\)/.test(recovery)],
  ['PIN replacement validates hash and salt formats at the database boundary', /p_pin_hash.*\[0-9a-f\]\{64\}/s.test(atomic) && /p_pin_salt.*\[0-9a-f\]\{32\}/s.test(atomic)],
  ['PIN replacement and recovery lock reset occur in the same RPC transaction', /UPDATE public\.gh_withdrawal_pins[\s\S]*UPDATE public\.gh_withdrawal_pin_recovery/.test(atomic)],
  ['successful recovery enforces a 24-hour PIN reset cooldown', /reset_cooldown_until = now\(\) \+ interval '24 hours'/.test(atomic)],
  ['withdrawal PIN attempt refuses requests during the reset cooldown', /reset_cooldown_until IS NOT NULL AND r\.reset_cooldown_until > now\(\)/.test(pinMigration)],
  ['recovery RPCs are revoked from client roles and granted only to service_role', /REVOKE ALL ON FUNCTION public\.gh_withdrawal_pin_recovery_reset_pin\(text, text, text\) FROM PUBLIC, anon, authenticated/.test(atomic) && /GRANT EXECUTE ON FUNCTION public\.gh_withdrawal_pin_recovery_reset_pin\(text, text, text\) TO service_role/.test(atomic)],
  ['recovery status and mutation routes use bounded bodies and durable fail-closed limits', /checkDurableRateLimit/.test(route) && /onUnavailable: "deny"/.test(route) && /readBoundedJson\(request, 4 \* 1024\)/.test(route)],
  ['legacy wallet security gate checks the actual atomic migration for the cooldown contract', /atomicMig/.test(oldGate) && /reset_cooldown_until = now/.test(oldGate)],
  ['CI preserves Next build diagnostics on failure for actionable follow-up', /Preserve Next\.js build diagnostics on failure/.test(ci) && /\.next\/diagnostics/.test(ci)],
  ['GitHub artifact uploader uses the Node 24-compatible v7 action, eliminating the Node 20 warning', /actions\/upload-artifact@v7/.test(ci) && !/actions\/upload-artifact@v4/.test(ci)],
  ['previous build-diagnostics contract follows the upgraded artifact action version', /actions\/upload-artifact@v7/.test(priorBuildGate) && !/actions\/upload-artifact@v4/.test(priorBuildGate)],
  ['reset RPC re-checks recovery lock while holding the recovery row lock', /FROM public\.gh_withdrawal_pin_recovery[\s\S]*FOR UPDATE[\s\S]*v_recovery\.locked_until/.test(raceGuard)],
  ['reset RPC serializes on PIN row and refuses to extend an active cooldown', /FROM public\.gh_withdrawal_pins[\s\S]*FOR UPDATE[\s\S]*v_pin\.reset_cooldown_until/.test(raceGuard)],
  ['additive race-guard migration preserves service-role-only execution', /REVOKE ALL ON FUNCTION public\.gh_withdrawal_pin_recovery_reset_pin\(text, text, text\) FROM PUBLIC, anon, authenticated/.test(raceGuard) && /GRANT EXECUTE ON FUNCTION public\.gh_withdrawal_pin_recovery_reset_pin\(text, text, text\) TO service_role/.test(raceGuard)],
  ['migration generator includes both atomic recovery migrations', existsSync('scripts/generate-migration-inventory.mjs') && /20261110100001_withdrawal_rpc_acl_and_recovery_atomicity\.sql/.test(read('scripts/generate-migration-inventory.mjs')) && /20261110110001_wallet_recovery_reset_lock_race_guard\.sql/.test(read('scripts/generate-migration-inventory.mjs'))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed += 1
}
console.log(`\nRun #249 wallet recovery/build guards: ${checks.length - failed}/${checks.length} passed; ${failed} failed.`)
if (failed) process.exit(1)
