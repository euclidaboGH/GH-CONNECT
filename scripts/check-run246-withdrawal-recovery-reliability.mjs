#!/usr/bin/env node
/** Run #246 regression contracts for payout Supabase ACLs, PIN recovery and account hydration. */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (file) => readFileSync(join(root, file), 'utf8')
const migrationPath = 'supabase/migrations/20261110100001_withdrawal_rpc_acl_and_recovery_atomicity.sql'
const migration = read(migrationPath)
const execute = read('app/api/economy/earnings/withdrawals/execute/route.ts')
const recovery = read('lib/server/identity/pin-recovery.ts')
const recoveryRoute = read('app/api/identity/pin-recovery/route.ts')
const membership = read('lib/domains/membership-domain.ts')
const health = read('lib/server/health/withdrawals-health.ts')
const postflight = read('supabase/tests/verify_run246_withdrawal_rpc_acl.sql')
const checks = [
  ['Run #246 additive migration exists', existsSync(join(root, migrationPath))],
  ['Payout request lookup is scoped to both request ID and authenticated user ID', /WHERE id = p_request_id AND user_id = trim\(p_user_id\)/.test(migration)],
  ['Payout lookup returns only the minimal execution fields', /'gross_atomic', v\.gross_atomic::text/.test(migration) && /'recipient_pi_app_uid', v\.recipient_pi_app_uid/.test(migration) && !/to_jsonb\(v\)/.test(migration)],
  ['Payout request table remains inaccessible directly to service_role', /REVOKE ALL ON TABLE public\.gh_pi_earnings_payout_requests FROM PUBLIC, anon, authenticated, service_role/.test(migration) && !/GRANT\s+SELECT[^;]*gh_pi_earnings_payout_requests/i.test(migration)],
  ['Payout lookup RPC is service-role-only and denies client roles', /REVOKE ALL ON FUNCTION public\.gh_pi_earnings_payout_get_owned\(uuid, text\) FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_pi_earnings_payout_get_owned\(uuid, text\) TO service_role/.test(migration)],
  ['Execution worker uses the owned lookup RPC, not direct payout table REST reads', /gh_pi_earnings_payout_get_owned/.test(execute) && !/gh_pi_earnings_payout_requests\?/.test(execute)],
  ['Malformed request IDs are rejected before UUID RPC casting', /\^\[0-9a-f\]\{8\}-\(\?:\[0-9a-f\]\{4\}-\)\{3\}\[0-9a-f\]\{12\}\$/.test(execute)],
  ['Payout lookup permission failures return a retryable 503 rather than an unhandled 500', /PAYOUT_STORAGE_UNAVAILABLE/.test(execute) && /\.catch\(\(error\)=>/.test(execute)],
  ['PIN recovery reads use the narrow server RPC and validate stored hash records', /gh_withdrawal_pin_recovery_get/.test(recovery) && /answers\.every\(isStoredAnswer\)/.test(recovery) && !/rest\/v1\/gh_withdrawal_pin_recovery\?/.test(recovery)],
  ['PIN recovery setup is insert-only through a service-role RPC', /gh_withdrawal_pin_recovery_setup/.test(recovery) && /ON CONFLICT \(user_id\) DO NOTHING/.test(migration)],
  ['Recovery failures increment under a database row lock', /gh_withdrawal_pin_recovery_record_failure/.test(recovery) && /FOR UPDATE/.test(migration) && /failed_attempts = v_attempts/.test(migration)],
  ['PIN reset and recovery-counter reset are one atomic RPC with 24-hour cooldown', /gh_withdrawal_pin_recovery_reset_pin/.test(recovery) && /reset_cooldown_until = now\(\) \+ interval '24 hours'/.test(migration)],
  ['Recovery table has no direct grants and all recovery RPCs are service-role-only', /REVOKE ALL ON TABLE public\.gh_withdrawal_pin_recovery FROM PUBLIC, anon, authenticated, service_role/.test(migration) && (migration.match(/GRANT EXECUTE ON FUNCTION public\.gh_withdrawal_pin_recovery_/g) || []).length === 4],
  ['PIN recovery status GET is protected by a durable fail-closed rate limit', /pin-recovery-status:\$\{auth\.userId\}/.test(recoveryRoute) && /onUnavailable: "deny"/.test(recoveryRoute)],
  ['PIN storage service-role grants are reasserted while client roles remain denied', /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.gh_withdrawal_pins TO service_role/.test(migration) && /REVOKE ALL ON TABLE public\.gh_withdrawal_pins FROM PUBLIC, anon, authenticated/.test(migration)],
  ['withdrawal health checks the payout lookup and PIN recovery RPC contracts', /gh_pi_earnings_payout_get_owned/.test(health) && /gh_withdrawal_pin_recovery_get/.test(health) && /payout_execution_lookup_rpc/.test(health) && /pin_recovery_rpc/.test(health)],
  ['read-only database postflight verifies effective ACLs and RLS without touching user rows', /has_table_privilege/.test(postflight) && /has_function_privilege/.test(postflight) && /relrowsecurity/.test(postflight) && !/UPDATE public\./.test(postflight)],
  ['Only server-confirmed account anchors suppress repeat hydration requests', /SERVER_ACCOUNT_CACHE_KEY/.test(membership) && /readServerConfirmedAccountCreatedAt\(userId\)/.test(membership) && /server-confirmed value can safely/.test(membership)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed += 1
}
console.log(`\nRun #246 withdrawal/recovery reliability: ${checks.length - failed}/${checks.length} passed; ${failed} failed.`)
if (failed) process.exit(1)
