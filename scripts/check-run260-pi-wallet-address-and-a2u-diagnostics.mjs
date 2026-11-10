#!/usr/bin/env node
/** Run #260: Pi wallet-address proof and actionable A2U provider diagnostics. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const route = read('app/api/economy/earnings/withdrawals/execute/route.ts')
const adapter = read('lib/server/payments/pi-platform-a2u.ts')
const auth = read('lib/server/economy/auth.ts')
const consent = read('lib/server/identity/wallet-consent.ts')
const client = read('lib/client/pi-wallet-consent.ts')
const grantRoute = read('app/api/identity/wallet-authorization/route.ts')
const walletStore = read('lib/server/identity/wallet-authorization.ts')
const migration = read('supabase/migrations/20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql')
const dash = read('components/ghc/unified-earnings-dashboard.tsx')
const health = read('lib/server/health/withdrawals-health.ts')
const requestRoute = read('app/api/economy/earnings/withdrawals/route.ts')
const walletBalance = read('features/wallet/wallet-balance.tsx')
const sheet = read('components/ghc/pi-withdraw-sheet.tsx')
const withdrawable = read('app/api/economy/earnings/withdrawable/route.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['A2U incomplete-payment lookup uses Pi Platform v2 endpoint directly', /\/payments\/incomplete_server_payments/.test(adapter) && /Authorization: `Key \$\{apiKey\}`/.test(adapter)],
  ['provider lookup failures preserve safe HTTP/provider codes instead of SDK unknown_error', /PI_INCOMPLETE_LOOKUP_HTTP_\$\{response\.status\}/.test(adapter) && /providerCode/.test(adapter)],
  ['withdrawal health now probes the actual global incomplete A2U lane read-only', /probePiIncompleteA2u/.test(health) && /getPiIncompleteA2uPayments/.test(health) && /PI_A2U_INCOMPLETE_PAYMENT_PRESENT/.test(health)],
  ['withdrawal health validates the backend SDK and seed without creating a payment', /probePiBackendSdk/.test(health) && /new PiBackend\(apiKey, walletSeed\)/.test(health) && /No payment was attempted/.test(health)],
  ['worker records exact execution stage and diagnostic code without raw provider message', /providerStage="INCOMPLETE_LOOKUP"/.test(route) && /stage:providerStage/.test(route) && /diagnosticCode:failureCode/.test(route) && !/error\.message/.test(route.slice(route.indexOf('} catch(error)')))],
  ['provider error codes are normalized and bounded', /safeProviderCode/.test(adapter) && /slice\(0, 120\)/.test(adapter)],
  ['create race recovers only exact matching A2U payment; unrelated payment enters review', /ongoing_payment_found/.test(adapter) === false && /providerPayment\?\.identifier && matches/.test(route) && /UNRELATED_INCOMPLETE_A2U_PAYMENT/.test(route)],
  ['wallet consent requests Pi wallet_address scope only during explicit consent', /piAuthenticateOfficial\(\["username", "payments", "wallet_address"\]\)/.test(client)],
  ['server verifies the Pi token UID and binds the official SDK address; provider destination is authoritative', /verifyPiAccessToken/.test(auth) && /piUser\.uid/.test(consent) && /walletAddress: parsedBody\.value\.walletAddress/.test(grantRoute) && /payment\.to_address/.test(route)],
  ['Pi wallet address is bound to the same durable Pi UID and valid public-key format', /mapping\.piAppUid !== piUser\.uid/.test(consent) && /\^G\[A-Z2-7\]\{55\}\$/.test(consent)],
  ['grant RPC persists the Pi SDK/API wallet address and source', /p_pi_wallet_address/.test(walletStore) && /piWalletAddress/.test(walletStore) && /walletAddressVerifiedAt/.test(walletStore)],
  ['new migration leaves legacy rows unverified and fails closed for old grant signature', /ADD COLUMN IF NOT EXISTS pi_wallet_address/.test(migration) && /PI_WALLET_ADDRESS_PROOF_REQUIRED/.test(migration)],
  ['database prevents another active withdrawal while reserved, processing or uncertain', /status IN \('reserved','processing','uncertain'\)/.test(migration) && /PAYOUT_ALREADY_IN_PROGRESS/.test(migration) && /activeRequestId/.test(requestRoute)],
  ['ambiguous prior attempt may recover an exact incomplete payment but never create a replacement', /execution_attempts/.test(migration) && /hasAmbiguousPriorAttempt/.test(route) && /else if\(hasAmbiguousPriorAttempt\)/.test(route) && /PI_UNCERTAIN_REQUEST_REQUIRES_OPERATOR_RECONCILIATION/.test(route)],
  ['payout assertion requires a bound Pi wallet address and records its source', /PI_WALLET_ADDRESS_VERIFICATION_REQUIRED/.test(migration) && /wallet_address_source/.test(migration) && /pi_sdk_scope/.test(migration)],
  ['provider PaymentDTO destination must match before submit and again on independent receipt before settlement', /payment\.to_address/.test(route) && /receipt\.to_address/.test(route) && /receiptToAddress!==expectedWalletAddress/.test(route) && /gh_pi_wallet_authorization_confirm_provider_address/.test(route) && /p_receipt->>'to_address' IS DISTINCT FROM v_expected_wallet_address/.test(migration)],
  ['payout request snapshots its recipient wallet address and blocks changes before execution', /recipient_wallet_address/.test(migration) && /recipient_wallet_address/.test(route) && /PI_WALLET_ADDRESS_CHANGED_SINCE_REQUEST/.test(route)],
  ['wallet authorization table remains private and all wallet RPCs remain service-role-only', /ENABLE ROW LEVEL SECURITY/.test(read('supabase/migrations/20261029010005_pi_identity_wallet_authorization.sql')) && /FROM PUBLIC,\s*anon,\s*authenticated,\s*service_role/.test(migration) && /TO service_role/.test(migration) && !/TO authenticated/.test(migration)],
  ['wallet API returns address only through authenticated no-store status response', /resolveAuthenticatedUser/.test(grantRoute) && /Cache-Control.*no-store/.test(grantRoute) && /piWalletAddress/.test(grantRoute)],
  ['wallet UI masks address by default and supports explicit copy', /data-pi-wallet-address/.test(dash) && /slice\(0, 7\).*slice\(-6\)/.test(dash) && /navigator\.clipboard\?\.writeText/.test(dash)],
  ['wallet UI explains A2U uses app-specific Pi UID, not a user-entered address', /A2U payouts are addressed by Pi's app-specific user ID/.test(dash) && /A2U itself is routed by Pi UID/.test(sheet)],
  ['withdrawal UI explains uncertain outcomes and surfaces safe diagnostic references', /PI_EARNINGS_EXECUTION_UNCERTAIN/.test(sheet) && /Reference: \$\{r\.diagnosticCode/.test(sheet)],
  ['Wallet offers a user-triggered reconciliation action only for existing uncertain requests', /item\.status\.toLowerCase\(\) === "uncertain"/.test(walletBalance) && /reconcilePiRequest/.test(walletBalance) && /\/api\/economy\/earnings\/withdrawals\/process/.test(walletBalance) && /PI_UNCERTAIN_REQUEST_REQUIRES_OPERATOR_RECONCILIATION/.test(walletBalance)],
  ['withdrawable API includes the owner-bound wallet address and source', /piWalletAddress: walletAuth\.piWalletAddress/.test(withdrawable) && /walletAddressSource: walletAuth\.walletAddressSource/.test(withdrawable)],
  ['package and app release metadata agree on 0.338.27', pkg.version === '0.338.27' && read('lib/app-release.ts').includes('0.338.27')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nRun #260 Pi wallet/A2U diagnostics: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
