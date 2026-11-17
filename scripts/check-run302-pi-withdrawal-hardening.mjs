#!/usr/bin/env node
/** Run #302: Pi withdrawal authorization and failure-diagnostic regression gate. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const consent = read('lib/server/identity/wallet-consent.ts')
const store = read('lib/server/identity/wallet-authorization.ts')
const route = read('app/api/identity/wallet-authorization/route.ts')
const client = read('lib/client/pi-wallet-consent.ts')
const card = read('components/ghc/pi-payout-authorization-card.tsx')
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} Run #302: ${name}`) }

test('wallet consent is proven by Pi /v2/me credentials.scopes; a platform address is used only when Pi returns one', /const scopeGranted = Array\.isArray\(piUser\.scopes\)/.test(consent) && /walletAddressSource: "platform_api"/.test(consent) && !/platformWalletAddress \|\| sdkWalletAddress/.test(consent))
test('browser SDK address is provisional only after server-verified scope and is compared with Platform data', /untrusted request data/.test(consent) && /platformWalletAddress !== sdkWalletAddress/.test(consent) && /walletAddressSource: sdkWalletAddress \? "pi_sdk_scope" : "scope_only"/.test(consent) && consent.indexOf('const scopeGranted') < consent.lastIndexOf('"pi_sdk_scope"'))
test('missing and browser-only unverified addresses have distinct errors', /PI_WALLET_ADDRESS_REQUIRED/.test(consent) && /PI_WALLET_ADDRESS_UNVERIFIED/.test(consent))
test('Pi UID is trimmed and bounded before identity mapping', /verifiedPiUid/.test(consent) && /verifiedPiUid\.length > 160/.test(consent))
test('forward mapping must belong to the authenticated GreenHaven user', /mapping\.ghUserId !== ghUserId/.test(consent))
test('reverse mapping must match both GreenHaven user and Pi UID', /reverse\.ghUserId !== ghUserId \|\| reverse\.piAppUid !== verifiedPiUid/.test(consent))
test('durable identity mapping is checked before wallet scope acceptance', consent.indexOf('deps.getByGhUserId') < consent.indexOf('const scopeGranted'))
test('wallet public-key format is validated server-side', /\^G\[A-Z2-7\]\{55\}\$/.test(consent))
test('grant service accepts Platform, SDK-provisional or scope-only provenance and nothing else', /walletAddressSource: "platform_api" \| "pi_sdk_scope" \| "scope_only"/.test(store) && /const scopeOnly = !address && input\.walletAddressSource === "scope_only"/.test(store))
test('grant inputs are bounded and validated before privileged RPC', /userId\.length > 160/.test(store) && /piUid\.length > 160/.test(store) && /PI_WALLET_ADDRESS_UNVERIFIED/.test(store))
test('grant RPC response must echo the exact UID, address and source', /GRANT_RESPONSE_MISMATCH/.test(store) && /result\.value\.piAppUid !== piUid/.test(store) && /input\.walletAddressSource/.test(store))
test('status active state requires a server-verified scope grant and a well-formed address when one is bound', /scopeVerifiedAt/.test(store) && /Boolean\(scopeVerifiedAt\)/.test(store) && /validAddress && Boolean\(source\)/.test(store))
test('legacy status exposes a reason without exposing a malformed wallet address', /authorizationReason/.test(store) && /piWalletAddress: uidMatches && validAddress \? address : null/.test(store))
test('payout assertion independently requires the verified scope timestamp and a known source for any bound address', /walletScopeVerifiedAt/.test(store) && /PI_WALLET_ADDRESS_VERIFICATION_REQUIRED/.test(store) && /pi_sdk_scope/.test(store))
test('GET authorization endpoint propagates store failure rather than returning success', /if \(!status\.ok\) return reply/.test(route))
test('grant endpoint preserves only allowlisted safe RPC business errors', /knownGrantErrors/.test(route) && /diagnosticCode: publicError/.test(route))
test('grant failure logs include stage and correlation ID but not token/address', /stage: "GRANT_RPC"/.test(route) && /requestId: requestId/.test(route) && !/accessToken|piWalletAddress/.test((route.match(/console\.error\(\"\[wallet-authorization\] grant failed\", \{[\s\S]*?\}\)/) || [''])[0]))
test('read-back requires the exact UID/address and a server-verified scope timestamp', /readbackAddress !== expectedAddress/.test(route) && /!verified\.walletScopeVerifiedAt/.test(route))
test('read-back failures retain a safe diagnostic code and request correlation', /stage: "READ_BACK"/.test(route) && /diagnosticCode/.test(route.slice(route.indexOf('independent read-back failed'))) && /knownReadbackErrors/.test(route))
test('provider-confirmed address remains trusted after an exact Pi PaymentDTO destination check', /provider_payment/.test(store) && /gh_pi_wallet_authorization_confirm_provider_address/.test(read('supabase/migrations/20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql')))
test('authorization card reuses the canonical timed status reader', /fetchWalletAuthorizationStatus/.test(card) && !/fetch\(\"\/api\/identity\/wallet-authorization/.test(card.slice(card.indexOf('const refresh'), card.indexOf('const grant'))))
test('client authorization is single-flight across mounted components', /consentInFlight/.test(client) && /if \(consentInFlight\) return consentInFlight/.test(client))
test('client status and grant requests have finite timeouts', /AbortSignal\.timeout\(12_000\)/.test(client) && /AbortSignal\.timeout\(15_000\)/.test(client))
test('client error normalization rejects inherited object properties', /Object\.hasOwn\(MESSAGES, c\)/.test(client))
test('client active state requires the server-verified scope timestamp', /body\.walletScopeVerifiedAt/.test(client) && /body\.authorizationActive === true && uidMatches/.test(client))
test('legacy authorization UI explains re-consent and Developer Portal permission', /previous Pi consent did not include a verified wallet_address permission/.test(card) && /wallet_address permission/.test(card))
test('wallet consent error copy never recommends manually entering a payout address', !/enter or substitute an address manually/i.test(consent + client))

const exec = read('app/api/economy/earnings/withdrawals/execute/route.ts')
const mig = read('supabase/migrations/20261116045934_pi_wallet_scope_consent_provider_address_discovery.sql')
test('payout worker never submits before the provider destination is a valid address bound to this request', exec.indexOf('gh_pi_wallet_authorization_adopt_provider_address') < exec.indexOf('providerStage="SUBMIT_PAYMENT"') && /PI_PROVIDER_WALLET_ADDRESS_INVALID/.test(exec) && /PI_PAYOUT_WALLET_ADDRESS_MISMATCH/.test(exec))
test('scope-only authorization adopts Pi PaymentDTO.to_address and refuses a conflicting bound address', /adopt_provider_address/.test(mig) && /PI_PAYOUT_WALLET_ADDRESS_MISMATCH/.test(mig) && /wallet_scope_verified_at IS NULL/.test(mig))
test('legacy UID-only and unproven-consent rows cannot be silently upgraded; backfill requires explicit consent and a recognized address source', /consent_source = 'user_explicit'/.test(mig) && /wallet_address_source IN \('pi_sdk_scope', 'platform_api', 'provider_payment'\)/.test(mig) && /wallet_scope_verified_at IS NULL THEN/.test(mig))
test('provider-address adoption is bound to exact provider payment, current UID mapping, Testnet, and an executable request', /v_req\.provider_payment_id IS DISTINCT FROM v_payment_id/.test(mig) && /v_req\.network IS DISTINCT FROM 'Pi Testnet'/.test(mig) && /v_req\.status NOT IN \('reserved','processing','uncertain'\)/.test(mig) && /IDENTITY_MAPPING_MISMATCH/.test(mig) && /p_provider_payment_id:paymentId/.test(exec))
test('new adoption RPC is service-role only and uses the five-argument signature', /REVOKE ALL ON FUNCTION public\.gh_pi_wallet_authorization_adopt_provider_address/.test(mig) && /GRANT EXECUTE ON FUNCTION public\.gh_pi_wallet_authorization_adopt_provider_address\(text,text,uuid,text,text\) TO service_role/.test(mig))
test('wallet address source validation is null-safe', /v_address_source IS NULL/.test(mig))

test('database schema gap is reported as an operator error, not a user retry', /WALLET_SCOPE_MIGRATION_REQUIRED/.test(route) && /scopeSchemaReady/.test(store) && /WALLET_SCOPE_MIGRATION_REQUIRED/.test(client) && /scopeOnly && error === "PI_WALLET_ADDRESS_REQUIRED"/.test(store))

test('every consent failure carries a secret-free build/stage/code diagnostic', /WALLET_AUTH_BUILD/.test(route) && /stage: "PI_PROOF"/.test(route) && /failWithDiagnostic/.test(client) && /replace\(\/\[\^A-Za-z0-9_\.:-\]\/g/.test(client))

const failed = checks.filter((x) => !x).length
console.log(`\nRun #302 Pi withdrawal hardening: ${checks.length - failed}/${checks.length} passed; ${failed} failed.`)
if (failed) process.exit(1)
