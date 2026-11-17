#!/usr/bin/env node
/** Phase 7 source contracts: Pi identity namespace and payout authorization. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), "utf8")
const auth = read("lib/server/economy/auth.ts")
const bridge = read("app/api/auth/pi/route.ts")
const walletAuth = read("lib/server/identity/wallet-authorization.ts")
const walletRoute = read("app/api/identity/wallet-authorization/route.ts")
const payout = read("app/api/economy/earnings/withdrawals/execute/route.ts")
const migration = read("supabase/migrations/20261029010005_pi_identity_wallet_authorization.sql")
const checks = [
  ["Pi platform token is verified by the official /v2/me endpoint", /env\.piPlatformApiUrl\}\/v2\/me/.test(read("lib/server/economy/auth.ts")) && /Authorization: `Bearer \$\{accessToken\}`/.test(read("lib/server/economy/auth.ts"))],
  ["Production Pi bearer auth fails closed when canonical mapping is absent", /if \(!mapping\?\.ghUserId\) \{\s*if \(env\.isProduction\) return null/s.test(auth)],
  ["Pi UID fallback is explicitly limited to non-production compatibility", /if \(!mapping\?\.ghUserId\)[\s\S]*?if \(env\.isProduction\) return null[\s\S]*?Non-production compatibility only/s.test(auth)],
  ["Mapped GH identity, not raw Pi UID, is returned when mapping exists", /userId: mapping\.ghUserId/.test(auth)],
  ["Pi bootstrap creates the mapping only after /v2/me token verification", /verifyPiAccessToken\(accessToken\)/.test(bridge) && /findOrCreateFromVerifiedPi/.test(bridge)],
  ["Production bootstrap refuses non-durable identity and session stores", /prod && \(!isPiIdentityDurable\(\) \|\| !isSessionStoreDurable\(\)\)/.test(bridge)],
  ["Wallet consent is based on fresh verified Pi proof", /verifyWalletConsentProof/.test(walletRoute) && /verifyPiAccessToken/.test(walletRoute)],
  ["Payout authorization binds canonical user to exact recipient UID", /gh_pi_wallet_authorization_assert_payout/.test(walletAuth) && /p_recipient_uid/.test(walletAuth)],
  ["Payout execution checks authorization before provider payment work", payout.indexOf("assertPayoutWalletAuthorization") >= 0 && payout.indexOf("assertPayoutWalletAuthorization") < payout.indexOf("sdk.createPayment")],
  ["Authorization RPCs are service-role-only with client access denied", /GRANT EXECUTE ON FUNCTION public\.gh_pi_wallet_authorization_assert_payout/.test(migration) && /REVOKE ALL ON FUNCTION public\.gh_pi_wallet_authorization_assert_payout/.test(migration) && /WITH CHECK \(false\)/.test(migration)],
]
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`)
const failed = checks.filter(([, ok]) => !ok)
console.log(`\nPhase 7 Pi identity and payout checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
